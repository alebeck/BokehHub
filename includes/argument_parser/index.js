/*
* BokehHub
* Author: Alexander Becker
* (c) 2018
*/

var ArgumentParser = require('argparse').ArgumentParser;

var parser = new ArgumentParser({
  version: '0.0.1',
  addHelp: true,
  description: 'BokehHub'
});

parser.addArgument(
  [ '-p', '--port' ],
  {
    help: 'The port on which the application launches',
    defaultValue: 8000,
    type: 'int'
  }
);

parser.addArgument(
  '--plotPath',
  {
    help: 'Path of the Bokeh server\'s plots',
    defaultValue: './bokehserver/plots/'
  }
);

parser.addArgument(
  '--dataPath',
  {
    help: 'Path of the Bokeh server\'s datasets',
    defaultValue: './bokehserver/data/datasets/'
  }
);

parser.addArgument(
  '--bokehPath',
  {
    help: 'Path of the Bokeh server executable',
    defaultValue: './bokehserver/bokehserver.py'
  }
);

parser.addArgument(
  '--configPath',
  {
    help: 'Path of the configuration file',
    defaultValue: './config/default.json'
  }
);

parser.addArgument(
  '--bokehPort1',
  {
    help: 'Port of the first bokeh server',
    defaultValue: 8001,
    type: 'int'
  }
);

parser.addArgument(
  '--bokehPort2',
  {
    help: 'Port of the second bokeh server',
    defaultValue: 8002,
    type: 'int'
  }
);

module.exports = parser;