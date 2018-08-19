/*
* BokehHub
* Author: Alexander Becker
* (c) 2018
*/

const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const proxy = require('http-proxy-middleware');
const RedisStore = require('connect-redis')(session);
const bcrypt = require('bcrypt');
const Config = require('node-json-config');
const spawn = require('child_process').spawn;
const randomstring = require('randomstring');
const mustacheExpress = require('mustache-express');
const request = require('request-promise');

const parser = require('./lib/argument-parser');
const fileUpload = require('./lib/express-fileupload');

const args = parser.parseArgs();
const config = new Config(args.configPath);
const app = express();

var bokehServers = [
    {port: args.bokehPort1, active: false},
    {port: args.bokehPort2, active: true}
];

console.log(bokehServers);

var restartCallbacks = [];
var bokehRestarting = false;
var bokehQueue = [];
var plots = [];
var datasets = [];

function getDate(date) {
    return date.toISOString().split('T')[0];
}

function getTitle(code) {
    var firstLine = code.split('\n')[0];
    if (firstLine.startsWith('#!')) {
        return firstLine.slice(2).trim();
    }
    return null;
}

function generateID() {
    return randomstring.generate({length: 8, charset: 'hex'});
}

function generateToken() {
    return randomstring.generate({length: 16, charset: 'alphanumeric'});
}

function _restart(writeFile, onRestart, onError) {
    bokehRestarting = true;
    console.log('Restarting bokeh server...');

    let active = bokehServers.filter(server => server.active)[0]
    let inactive = bokehServers.filter(server => !server.active)[0]

    writeRecursive = function(i) {
        writeFile[i](function(err) {
            if (err) {
                onRestart[i] = () => { onError[i]() };
            }
            if (i < writeFile.length - 1) {
                writeRecursive(i + 1);
            } else {
                // Restart inactive server
                var onExit = function(code) {
                    // inactive server has exited
                    var proc = spawn('python3', [args.bokehPath, inactive.port], {detached: false});
                    proc.stdout.on('data', (data) => {
                        var out = String.fromCharCode.apply(null, data);
                        if (out === 'SERVER READY') {
                            console.log('Server ready.');
                            // execute all onRestart callbacks
                            onRestart.forEach(f => f());

                            // switch active server
                            active.active = false;
                            inactive.active = true;

                            // notify clients
                            restartCallbacks.forEach(cb => cb())
                            restartCallbacks = [];
                            bokehRestarting = false;

                            // trigger next server restart if queue is not empty
                            if (bokehQueue.length) {
                                writeFileFuncs = bokehQueue.map(o => o.writeFile);
                                onRestartFuncs = bokehQueue.map(o => o.onRestart);
                                onErrorFuncs = bokehQueue.map(o => o.onError);
                                bokehQueue = [];
                                _restart(writeFileFuncs, onRestartFuncs, onErrorFuncs);
                            }
                        }
                        else if (out.startsWith('ERROR PLOT ')) {
                            console.error(out);
                            var splitted = out.split(' ');
                            var id = splitted[2];
                            var message = splitted.slice(3).join(' ');
                            for (var i = 0; i < bokehQueue.length; i++) {
                                if (bokehQueue[i].arg.plot && bokehQueue[i].arg.plot === id) {
                                    // plot is in queue
                                    return;
                                }
                            }
                            plots.forEach((p) => {
                                if (p.id === id) {
                                    onRestart.push(() => {
                                        p.status = 'error';
                                        p.errmsg = message;
                                    })
                                }
                            })
                        }
                        else if (out.startsWith('ERROR DATASET ')) {
                            console.error(out);
                            var splitted = out.split(' ');
                            var name = splitted[2];
                            var message = splitted.slice(3).join(' ');
                            for (var i = 0; i < bokehQueue.length; i++) {
                                if (bokehQueue[i].arg.dataset && bokehQueue[i].arg.dataset === name) {
                                    // dataset is in queue
                                    return;
                                }
                            }
                            datasets.forEach(function(d) {
                                if (d.name === name) {
                                    onRestart.push(() => {
                                        d.status = 'error';
                                        d.errmsg = message;
                                    })
                                }
                            })
                        }
                    });
                    proc.stderr.on('data', (data) => {
                        console.error(data.toString('utf8'))
                        bokehRestarting = false;
                    });
                    inactive.proc = proc;
                }

                if (inactive.proc) {
                    // wait until server has exited
                    inactive.proc.on('exit', (code) => {
                        onExit(code);
                    });
                    inactive.proc.kill();
                }
                else {
                    // restart server directly
                    onExit(0)
                }
            }
        })
    }
    writeRecursive(0);
}

function restartServer(arg, writeFile, updateState, res) {
    // function to apply a function on every object which was changed
    var apply = function(cb) {
        pending = [];
        if (arg.plot) {
            pending = plots.filter(p => p.id == arg.plot);
        }
        else if (arg.dataset) {
            pending = datasets.filter(d => d.name == arg.dataset);
        }
        pending.forEach(obj => cb(obj))
    }

    apply(obj => obj.status = 'pending');
    res.json({success: true}).end();

    var onRestart = function() {
        // update state
        updateState(apply);
        // set changed object to 'ready'
        apply(obj => obj.status = 'ready');
    }

    var onError = function(errmsg) {
        // set changed object to 'error'
        apply(obj => {
            obj.status = 'error';
            obj.errmsg = errmsg;
        });
    }

    if (!bokehRestarting) {
        // directly restart
        _restart([writeFile], [onRestart], [onError]);
    } else {
        // add restart to queue
        bokehQueue.push({writeFile: writeFile, onRestart: onRestart, onError: onError, arg: arg});
    }
}

// read template config if necessary
if (!config.get('logins')) {
    console.log("Initialize config from template...");
    let template = JSON.parse(fs.readFileSync('./templates/config.tmpl'));
    Object.keys(template).forEach(function(key) {
        config.put(key, template[key])
    });
    config.save();
}

// read in data
var tokens = {};
plots = [];
files = fs.readdirSync(args.plotPath).filter(f => f.match(/plot_.{8}\.py/));
files.forEach(function(file, i) {
    code = fs.readFileSync(args.plotPath + file, 'utf8');
    stats = fs.statSync(args.plotPath + file);
    id = file.split('_')[1].split('.')[0];

    plots.push({
        id: id,
        date: getDate(stats.mtime),
        title: getTitle(code),
        code: code,
        status: 'pending'
    })
})

datasets = [];
files = fs.readdirSync(args.dataPath);
files.forEach(function(file, i) {
    if (file.startsWith('.')) {
        return;
    }
    stats = fs.statSync(args.dataPath + file);
    datasets.push({
        name: file,
        date: getDate(stats.mtime),
        status: 'pending'
    })
})

// start server
_restart(
    [cb => cb(false)],
    [() => {
        plots.forEach(p => p.status = 'ready');
        datasets.forEach(d => d.status = 'ready');
    }],
    [() => {}]
)

const subscribe = function(req, res) {
    restartCallbacks.push(() => res.json({restarted: true}));
}

const getPlots = function(req, res) {
    res.json(plots);
}

const putPlot = function(req, res) {
    if (!req.params.id || !req.body.code) {
        res.json({success: false});
        return;
    }
    // define function which writes changes to drive
    var writeFile = function(cb) {
        fs.writeFile(args.plotPath + 'plot_' + req.params.id + '.py', req.body.code, err => cb(err));
    }
    var updateState = function(apply) {
        apply(obj => {
            obj.code = req.body.code;
            obj.date = getDate(new Date());
            obj.title = getTitle(req.body.code);
        });
    }
    // restart server
    restartServer({plot: req.params.id}, writeFile, updateState, res);
}

const deletePlot = function(req, res) {
    if (!req.params.id) {
        res.json({success: false});
        return;
    }
    // define function which writes changes to drive
    var writeFile = function(cb) {
        fs.unlink(args.plotPath + 'plot_' + req.params.id + '.py', err => cb(err));
        config.remove('tokens.' + req.params.id);
        config.save();
    }
    var updateState = function(apply) {
        apply(obj => { plots = plots.filter(p => p.id != obj.id)});
    }
    // restart server
    restartServer({plot: req.params.id}, writeFile, updateState, res);
}

const postPlot = function(req, res) {
    if (!req.body.code) {
        res.json({success: false});
        return;
    }
    var id = generateID();
    var token = generateToken();
    plots.push({
        id: id,
        code: req.body.code,
        title: getTitle(req.body.code),
        status: 'pending',
        date: getDate(new Date()),
        token: token
    })
    var writeFile = function(cb) {
        fs.writeFile(args.plotPath + 'plot_' + id + '.py', req.body.code, err => cb(err));
        config.put('tokens.' + id, token);
        config.save();
    }

    restartServer({plot: id}, writeFile, () => {}, res);
}

const login = function(req, res) {
    if (!req.body.user || !req.body.password) {
        res.json({success: false});
        return
    }

    let login = config.get('logins').filter(login => login.name === req.body.user)[0];
    if (!login) {
        res.json({success: false});
        return
    }

    bcrypt.compare(req.body.password, login.password, function(err, response) {
        if (response === true) {
            req.session.user = {name: login.name, admin: login.admin};
            res.json({
                success: true,
                user: req.session.user,
                settings: config.get('settings')
            });
            return;
        }
        res.json({success: false});
    });
}

const logout = function(req, res) {
    req.session.user = null;
    res.json({success: true});
}

const getDatasets = function(req, res) {
    res.json(datasets);
}

const putDataset = function(req, res) {
    if (!req.params.name || !req.files.file) {
        res.json({success: false});
        return
    }
    var file = req.files.file;
    // define function which writes changes to drive
    var writeFile = function(cb) {
        fs.unlink(args.dataPath + req.params.name , (err) => {
            if (err) {
                cb(err);
            }
            file.mv(args.dataPath + req.params.name, err => cb(err))
        });
    };
    var updateState = function(apply) {
        apply(obj => {
            obj.name = req.params.name;
            obj.date = getDate(new Date());
        });
    };
    // restart server
    restartServer({dataset: req.params.name}, writeFile, updateState, res);
}

const postDataset = function(req, res) {
    if (!req.files.file) {
        res.json({success: false});
        return
    }
    var file = req.files.file;
    if (datasets.filter(d => d.name === file.name).length) {
        res.json({success: false, errmsg: 'A file with that name already exists.'});
        return;
    }
    var writeFile = function(cb) {
        file.mv(args.dataPath + file.name, err => cb(err))
    }
    datasets.push({
        name: file.name,
        date: getDate(new Date()),
        status: 'pending'
    })
    restartServer({dataset: file.name}, writeFile, () => {}, res);
}

const deleteDataset = function(req, res) {
    if (!req.params.name) {
        res.json({success: false});
        return;
    }
    var writeFile = function(cb) {
        fs.unlink(args.dataPath + req.params.name , err => cb(err));
    }
    var updateState = function(apply) {
        apply(obj => { datasets = datasets.filter(d => d.name != obj.name)});
    }
    restartServer({dataset: req.params.name}, writeFile, updateState, res);
}

const download = function(req, res) {
    if (!req.params.name) {
        res.status(400).end();
        return;
    }
    res.sendFile(process.cwd() + '/' + args.dataPath + req.params.name)
}

const getSettings = function(req, res) {
    if (!req.session.user || !req.session.user.admin) {
        res.status(401).end();
        return;
    }
    res.json({success: true, settings: config.get('settings')});
}

const putSettings = function(req, res) {
    if (!req.session.user || !req.session.user.admin) {
        res.status(401).end();
        return;
    } else if (!req.body.settings) {
        res.json({success: false});
        return;
    }

    let settings = req.body.settings;
    if (settings.old && settings.new && settings.new_rep) {
        // change password
        let logins = config.get('logins');
        let login = logins.filter(l => l.name === req.session.user.name)[0]
        bcrypt.compare(settings.old, login.password, function(err, response) {
            if (response && settings.new === settings.new_rep) {
                bcrypt.hash(settings.new, 10).then(function(hash) {
                    login.password = hash;
                    config.put('logins', logins);
                    config.put('settings', {
                        hostname: settings.hostname,
                        defaultCode: settings.defaultCode
                    });
                    config.save();
                    res.json({success: true});
                });
            } else {
                res.json({success: false});
            }
        });
    }
    else {
        config.put('settings', {
            hostname: settings.hostname,
            defaultCode: settings.defaultCode
        });
        config.save();
        res.json({success: true});
    }
}

const getTokens = function(req, res) {
    if (!req.params.plotId) {
        res.status(400).end();
        return;
    }
    tokens = config.get('tokens.' + req.params.plotId);
    if (tokens) {
        res.json({success: true, tokens: tokens})
        return
    }
    res.json({success: true, tokens: []})
}

const postToken = function(req, res) {
    // post a name, add it to config and return token
    if (!req.body.name || !req.body.plotId) {
        res.status(400).end();
        return;
    }
    tokens = config.get('tokens.' + req.body.plotId);
    if (!tokens) {
        tokens = [];
    }
    var token = {name: req.body.name, token: generateToken()};
    tokens.push(token)
    config.put('tokens.' + req.body.plotId, tokens);
    config.save();
    res.json({success: true, token: token})
}

const deleteToken = function(req, res) {
    if (!req.body.plotId || !req.body.token) {
        res.status(400).end();
        return;
    }
    tokens = config.get('tokens.' + req.body.plotId);
    tokens = tokens.filter(t => t.token != req.body.token);
    config.put('tokens.' + req.body.plotId, tokens);
    config.save();
    res.json({success: true})
}

// Session authentication middleware
const sessionAuth = function(req, res, next) {
    if (!req.session.user && req.originalUrl !== '/api/login' && req.originalUrl !== '/api/logout') {
        res.status(401).end();
        return;
    }
    next();
};

// set view engine
app.engine('mustache', mustacheExpress());
app.set('views', './render');
app.set('view engine', 'mustache');

/*const _session = session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 600000
    }
});*/

const _session = session({
    store: new RedisStore({host: 'redis'}),
    secret: generateToken(),
    saveUninitialized: false,
    resave: false
});

app.use(_session);

app.use(bodyParser.urlencoded({'extended':'true'})); // parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json

app.use(express.static('ui/dist'));
app.use('/css', express.static('css'));
app.get('/js', function (req, res) {
    res.render('client', {hostname: config.get('settings.hostname')})
});

var api = express.Router();
api.get('/subscribe', subscribe);
api.get('/plots', getPlots);
api.put('/plots/:id', putPlot);
api.delete('/plots/:id', deletePlot);
api.post('/plots', postPlot);
api.post('/login', login);
api.get('/logout', logout);
api.get('/datasets', getDatasets);
api.post('/datasets', fileUpload(), postDataset);
api.delete('/datasets/:name', deleteDataset);
api.put('/datasets/:name', fileUpload(), putDataset);
api.get('/download/:name', download);
api.get('/settings', getSettings);
api.put('/settings', putSettings);
api.get('/tokens/:plotId', getTokens);
api.post('/tokens', postToken);
api.delete('/tokens', deleteToken);
app.use('/api', sessionAuth, api);

app.get('/script/:id', function(req, res) {
    if (!req.params.id || !req.query.token) {
        res.status(400).end();
        return;
    }
    let id = req.params.id;
    let token = req.query.token;
    let tokens = config.get('tokens.'+id);

    if (tokens) {
        tokens = tokens.map(t => t.token);
    } else {
        tokens = [];
    }

    if (tokens.includes(token) || req.session.user) {
        let port = bokehServers.filter(server => server.active)[0].port;
        let elemId = req.query.elemid || id;
        let raw_host = config.get('settings.hostname');

        request.get(`http://localhost:${port}/${id}/autoload.js?bokeh-autoload-element=${elemId}&bokeh-app-path=/${id}` +
            `&bokeh-absolute-url=${raw_host}/${id}&bokeh-session-id=${token}`) // use token as session id to recognize it later
            .then(function(body) {
                // pipe body to client
                res.send(body);
            })
            .catch(function(err) {
                res.status(500).end();
                console.error(err);
            })
    } else {
        res.status(401).end();
    }
});

// this middleware proxies incoming requests to static bokeh files
app.use('/static/*', proxy({
    target: 'http://localhost/',
    changeOrigin: true,
    logLevel: 'warn',
    router: function(req) {
        let port = bokehServers.filter(server => server.active)[0].port;
        return 'http://localhost:'+port;
    }
}));

// this middleware proxies websocket connections to the bokeh servers
var wsProxy = proxy(filter, {
    target: `http://localhost:${bokehServers.filter(server => server.active)[0].port}/`,
    changeOrigin: true,
    ws: true,
    logLevel: 'warn',
    router: function(req) {
        // extract token
        let token = req.url.match(/bokeh-session-id=[\w]+/);
        // extract plot id
        let id = req.url.match(/\/\w{8}\/ws/);

        if (!token || !id) {
            // fail
            return 'http://localhost:7000/';
        }
        token = token[0].split('=')[1];
        id = id[0].split('/')[1];

        let tokens = config.get('tokens.'+id);
        tokens = tokens ? tokens.map(t => t.token) : [];

        if (tokens.includes(token) || req.session.user) {
            let port = bokehServers.filter(server => server.active)[0].port;
            return 'http://localhost:'+port;
        }
        // fail
        return 'http://localhost:7000/';
    }
});

app.use(wsProxy);

console.log(`BokehHub starting on port ${args.port}`);

app.listen(args.port).on('upgrade', (req, socket) => {
    _session(req, {}, () => {
        // Calls proxy when req.session is already present
        wsProxy.upgrade(req, socket)
    })
});