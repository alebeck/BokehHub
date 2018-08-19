FROM node:8
MAINTAINER Alexander Becker "alexander.becker@cs.tum.edu"

WORKDIR /usr/src/bokehhub

# install python
RUN apt-get update \
 && apt-get install -y python3-pip python3-dev \
 && cd /usr/local/bin \
 && ln -s /usr/bin/python3 python \
 && pip3 install --upgrade pip \
 && pip3 install --upgrade six

# install npm packages
COPY package*.json ./
RUN npm install --only=production

# install pip packages
COPY requirements.txt ./
RUN pip3 install --no-build-isolation -r requirements.txt

# copy application
COPY . .

# declare used ports
EXPOSE 8000

# don't run application as root
USER node

# set node to production
ENV NODE_ENV=production

CMD [ "node", "server.js" ]