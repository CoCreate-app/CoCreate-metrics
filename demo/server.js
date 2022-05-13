'use strict';

const express = require('express');
const { createServer } = require('http');
const MongoClient = require('mongodb').MongoClient;
const config = require('./config.json');

const SocketServer = require("@cocreate/socket-server")
const CoCreateMetrics= require("../index")
const socketServer = new SocketServer("ws");

const port = process.env.PORT || 8081;

let dbURL = process.env.MONGO_URL || config.db_url;
MongoClient.connect(dbURL, { useNewUrlParser: true })
	.then(db_client => {
		  CoCreateMetrics.init(socketServer, db_client);
	})
	.catch(error => console.error(error));
		
const app = express();

const server = createServer(app);

server.on('upgrade', function upgrade(request, socket, head) {
  if (!socketServer.handleUpgrade(request, socket, head)) {
    socket.destroy();
  }
});

server.listen(port);
