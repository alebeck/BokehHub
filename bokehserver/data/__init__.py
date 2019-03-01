# BokehHub
# Author: Alexander Becker
# (c) 2018

import os
import sys
import glob

datapath = {}

files = [f for f in glob.glob("./bokehserver/data/datasets/*") if not os.path.basename(f).startswith('.')]

for file in files:
    name = file.split("/")[-1]
    datapath[name] = file