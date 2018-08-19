# BokehHub
# Author: Alexander Becker
# (c) 2018

import os, glob, re, importlib, sys

from bokeh.server.server import Server
from bokeh.application import Application
from bokeh.application.handlers.function import FunctionHandler
from bokeh.util import session_id
from bokeh.embed import server_session

if len(sys.argv) > 1:
	PORT = int(sys.argv[1])
else:
	PORT = 8001

plotDict = {}

# include plot files found in /plots
for file in glob.glob("./bokehserver/plots/plot_*.py"):
	id = file[-11:-3]
	try:
		module = importlib.import_module("plots.plot_" + id)
		make_document = getattr(module, "make_document")
		plotDict[id] = Application(FunctionHandler(make_document))
	except Exception as e:
		sys.stdout.write("ERROR PLOT " + id + ' ' + str(e))
		sys.stdout.flush()

# define Bokeh applications
apps = { ('/' + id): fn for (id,fn) in plotDict.items() }

# define Bokeh server
server = Server(apps, port=PORT, allow_websocket_origin=["*"], sign_sessions=False, generate_session_ids=True)

# run server
sys.stdout.write("SERVER READY")
sys.stdout.flush()
server.run_until_shutdown()