/*
* BokehHub
* Author: Alexander Becker
* (c) 2018
*/

const fs = require('fs');
const express = require('express');
const https = require('https');
const http = require('http');
const bodyParser = require('body-parser');
const session = require('express-session');
const RateLimit = require('express-rate-limit');
const csurf = require('csurf');
const proxy = require('http-proxy-middleware');
const sseExpress = require('sse-express');
const path = require('path');
const RedisStore = require('connect-redis')(session);
const bcrypt = require('bcrypt');
const Config = require('node-json-config');
const spawn = require('child_process').spawn;
const randomstring = require('randomstring');
const mustacheExpress = require('mustache-express');
const request = require('request-promise');
const sanitize = require('sanitize-filename');

const parser = require('./lib/argument-parser');
const fileUpload = require('./lib/express-fileupload');

const args = parser.parseArgs();
const config = new Config(args.configPath);
const app = express();

var bokehServers = [
    {port: args.bokehPort1, active: false},
    {port: args.bokehPort2, active: true}
];

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

    var active = bokehServers.filter(server => server.active)[0];
    var inactive = bokehServers.filter(server => !server.active)[0];

    var writeRecursive = function(i) {
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
                        console.log('BokehServer: ' + out);

                        if (out === 'SERVER READY') {
                            // execute all onRestart callbacks
                            onRestart.forEach(f => f());

                            // switch active server
                            active.active = false;
                            inactive.active = true;

                            // notify clients
                            restartCallbacks.forEach(cb => cb())
                            //restartCallbacks = [];
                            bokehRestarting = false;

                            // trigger next server restart if queue is not empty
                            if (bokehQueue.length) {
                                var writeFileFuncs = bokehQueue.map(o => o.writeFile);
                                var onRestartFuncs = bokehQueue.map(o => o.onRestart);
                                var onErrorFuncs = bokehQueue.map(o => o.onError);
                                bokehQueue = [];
                                _restart(writeFileFuncs, onRestartFuncs, onErrorFuncs);
                            }
                        }
                        else if (out.startsWith('ERROR PLOT ')) {
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
                        console.error(data.toString('utf8'));
                        bokehRestarting = false;
                    });
                    inactive.proc = proc;
                };

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
    };
    writeRecursive(0);
}

function restartServer(arg, writeFile, updateState, res) {
    // function to apply a function on every object which was changed
    var apply = function(cb) {
        var pending = [];
        if (arg.plot) {
            pending = plots.filter(p => p.id == arg.plot);
        }
        else if (arg.dataset) {
            pending = datasets.filter(d => d.name == arg.dataset);
        }
        pending.forEach(obj => cb(obj))
    };

    apply(obj => obj.status = 'pending');
    res.json({success: true}).end();

    var onRestart = function() {
        // update state
        updateState(apply);
        // set changed object to 'ready'
        apply(obj => obj.status = 'ready');
    };

    var onError = function(errmsg) {
        // set changed object to 'error'
        apply(obj => {
            obj.status = 'error';
            obj.errmsg = errmsg;
        });
    };

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
    var code = fs.readFileSync(args.plotPath + file, 'utf8');
    var stats = fs.statSync(args.plotPath + file);
    var id = file.split('_')[1].split('.')[0];

    plots.push({
        id: id,
        date: getDate(stats.mtime),
        title: getTitle(code),
        code: code,
        status: 'pending'
    })
});

datasets = [];
files = fs.readdirSync(args.dataPath);
files.forEach(function(file, i) {
    if (file.startsWith('.')) {
        return;
    }
    var stats = fs.statSync(args.dataPath + file);
    datasets.push({
        name: file,
        date: getDate(stats.mtime),
        status: 'pending'
    })
});

// start server
_restart(
    [cb => cb(false)],
    [() => {
        plots.forEach(p => p.status = 'ready');
        datasets.forEach(d => d.status = 'ready');
    }],
    [() => {}]
);

// API endpoints
const api = express.Router();

api.get('/events', sseExpress, function(req, res) {
    restartCallbacks = [];
    restartCallbacks.push(() => {
        console.log('Sending restart event.');
        res.sse('message', 'restarted');
    });
    res.sse('message', 'connected')
});

api.get('/plots', function(req, res) {
    res.json(plots);
});

api.put('/plots/:id', function(req, res) {
    if (!req.params.id || !req.body.code) {
        res.json({success: false});
        return;
    }
    // define function which writes changes to drive
    var writeFile = function(cb) {
        fs.writeFile(args.plotPath + 'plot_' + sanitize(req.params.id) + '.py', req.body.code, err => cb(err));
    };
    var updateState = function(apply) {
        apply(obj => {
            obj.code = req.body.code;
            obj.date = getDate(new Date());
            obj.title = getTitle(req.body.code);
        });
    };
    // restart server
    restartServer({plot: req.params.id}, writeFile, updateState, res);
});

api.delete('/plots/:id', function(req, res) {
    if (!req.params.id) {
        res.json({success: false});
        return;
    }
    // define function which writes changes to drive
    var writeFile = function(cb) {
        fs.unlink(args.plotPath + 'plot_' + sanitize(req.params.id) + '.py', err => cb(err));
        config.remove('tokens.' + req.params.id);
        config.save();
    };
    var updateState = function(apply) {
        apply(obj => { plots = plots.filter(p => p.id != obj.id)});
    };
    // restart server
    restartServer({plot: req.params.id}, writeFile, updateState, res);
});

api.post('/plots', function(req, res) {
    if (!req.body.code) {
        res.json({success: false});
        return;
    }
    var id = generateID();
    plots.push({
        id: id,
        code: req.body.code,
        title: getTitle(req.body.code),
        status: 'pending',
        date: getDate(new Date())
    });
    var writeFile = function(cb) {
        fs.writeFile(args.plotPath + 'plot_' + id + '.py', req.body.code, err => cb(err));
    };

    restartServer({plot: id}, writeFile, () => {}, res);
});

api.post('/login', function(req, res) {
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
});

api.get('/logout', function(req, res) {
    req.session.user = null;
    res.json({success: true});
});

api.get('/datasets', function(req, res) {
    res.json(datasets);
});

api.put('/datasets/:name', fileUpload(), function(req, res) {
    if (!req.params.name || !req.files.file) {
        res.json({success: false});
        return
    }
    var file = req.files.file;
    // define function which writes changes to drive
    var writeFile = function(cb) {
        fs.unlink(args.dataPath + sanitize(req.params.name), (err) => {
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
});

api.post('/datasets', fileUpload(), function(req, res) {
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
    };
    datasets.push({
        name: file.name,
        date: getDate(new Date()),
        status: 'pending'
    });
    // restart server
    restartServer({dataset: file.name}, writeFile, () => {}, res);
});

api.delete('/datasets/:name', function(req, res) {
    if (!req.params.name) {
        res.json({success: false});
        return;
    }
    var writeFile = function(cb) {
        fs.unlink(args.dataPath + sanitize(req.params.name), err => cb(err));
    };
    var updateState = function(apply) {
        apply(obj => { datasets = datasets.filter(d => d.name != obj.name)});
    };

    // restart server
    restartServer({dataset: req.params.name}, writeFile, updateState, res);
});

api.get('/download/:name', function(req, res) {
    if (!req.params.name) {
        res.status(400).end();
        return;
    }
    res.sendFile(sanitize(req.params.name), {root: path.join(process.cwd(), args.dataPath)})
});

api.get('/settings', function(req, res) {
    if (!req.session.user || !req.session.user.admin) {
        res.status(401).end();
        return;
    }
    res.json({success: true, settings: config.get('settings')});
});

api.put('/settings', function(req, res) {
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
        let login = logins.filter(l => l.name === req.session.user.name)[0];
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
});

api.get('/tokens/:plotId', function(req, res) {
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
});

api.post('/tokens', function(req, res) {
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
});

api.delete('/tokens', function(req, res) {
    if (!req.body.plotId || !req.body.token) {
        res.status(400).end();
        return;
    }
    tokens = config.get('tokens.' + req.body.plotId);
    tokens = tokens.filter(t => t.token != req.body.token);
    config.put('tokens.' + req.body.plotId, tokens);
    config.save();
    res.json({success: true})
});

api.get('/csrf', function(req, res) {
    res.json({token: req.csrfToken()})
});

// Session authentication middleware
const sessionAuth = function(req, res, next) {
    if (!req.session.user 
        && req.originalUrl !== '/api/login' 
        && req.originalUrl !== '/api/logout'
        && req.originalUrl !== '/api/csrf') {
        
        res.status(401).end();
        return;
    }
    next();
};

// set view engine
app.engine('mustache', mustacheExpress());
app.set('views', './render');
app.set('view engine', 'mustache');

const _session = session({
    store: new RedisStore({host: 'redis'}),
    secret: generateToken(),
    saveUninitialized: false,
    resave: false
});

app.use(_session);

app.use(bodyParser.urlencoded({'extended':'true'}));
app.use(bodyParser.json());

app.use(express.static('ui/dist'));
app.use('/css', express.static('css'));
app.get('/js', function (req, res) {
    res.render('client', {hostname: config.get('settings.hostname')})
});

const rateLimit = new RateLimit({
    windowMs: 1*60*1000, // 1 minute
    max: 30
});

app.use('/api', rateLimit, csurf(), sessionAuth, api);

// this endpoint delivers the bokeh autoload script
app.get('/script/:id', function(req, res) {
    if (!req.params.id || !req.query.token) {
        res.status(400).end();
        return;
    }
    let id = req.params.id;
    let token = req.query.token;
    let tokens = config.get('tokens.' + id);

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
            });
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
        return 'http://localhost:' + port;
    }
}));

// this middleware proxies websocket connections to the bokeh servers
var wsProxy = proxy('/*/ws', {
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

        if (tokens.includes(token) || (req.session && req.session.user)) {
            let port = bokehServers.filter(server => server.active)[0].port;
            return 'http://localhost:' + port;
        }
        // fail
        console.log('Fail ws proxy');
        console.log(req.session);
        return 'http://localhost:7000/';
    }
});

app.use(wsProxy);

if (args.cert) {
    https.createServer({
        key: args.key ? fs.readFileSync(args.key) : undefined,
        cert: args.cert ? fs.readFileSync(args.cert) : undefined,
        ca: args.chain ? fs.readFileSync(args.chain) : undefined
    }, app)
    .listen(args.port, () => {
        console.log(`Listening on port ${args.port} (TLS)...`);
    })
    .on('upgrade', (req, socket) => {
        _session(req, {}, () => {
            // Calls proxy when req.session is already present
            wsProxy.upgrade(req, socket);
        });
    });
}
else {
    http.createServer(app)
    .listen(args.port, () => {
        console.log(`Listening on port ${args.port}...`);
    })
    .on('upgrade', (req, socket) => {
        _session(req, {}, () => {
            // Calls proxy when req.session is already present
            wsProxy.upgrade(req, socket);
        });
    });
}
