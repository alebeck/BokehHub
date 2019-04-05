# BokehHub
# Author: Alexander Becker
# (c) 2018

import glob
import importlib
import sys
import timeout_decorator

from bokeh.server.server import Server
from bokeh.application import Application
from bokeh.application.handlers.function import FunctionHandler
from bokeh.document import Document

def write(text):
    sys.stdout.write(text)
    sys.stdout.flush()

PORT = int(sys.argv[1])
plotDict = {}

@timeout_decorator.timeout(60)
def add_function_handler(id):
    write('Importing module with id ' + id + '\n')
    module = importlib.import_module("plots.plot_" + id)
    make_document = getattr(module, "make_document")
    # invoke make_document to identify runtime errors
    make_document(Document())

    plotDict[id] = Application(FunctionHandler(make_document))

# include plot files found in /plots
for file in glob.glob("./bokehserver/plots/plot_*.py"):
    write('Reading in ' + file + '...\n')
    id = file[-11:-3]
    try:
        add_function_handler(id)
    except Exception as e:
        write("ERROR PLOT " + id + ' ' + str(e))

# define Bokeh applications
apps = { ('/' + id): fn for id, fn in plotDict.items() }

# define Bokeh server
server = Server(apps, port=PORT, allow_websocket_origin=["*"], sign_sessions=False, generate_session_ids=True)

# run server
sys.stdout.write("SERVER READY")
sys.stdout.flush()
server.run_until_shutdown()