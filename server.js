// Shit importeren en instellen

var http            = require('http');
var express         = require('express');
var webSocketServer = require('websocket').server;
var nano            = require('nano')('http://127.0.0.1:5984');

var userAPI         = require('./app/userapi');
var feedAPI         = require('./app/feedapi');
var chatAPI         = require('./app/chatapi');
var toolsAPI         = require('./app/toolsapi');

var app             = express();

var server          = http.createServer(app);
var wsServer        = new webSocketServer({ httpServer: server });

// JSON bodies toestaan
app.use(express.json());

app.use(express.static(__dirname + '/../client/angular/'));

// Router: websocket requests
wsServer.on('request', chatAPI.request);

app.all('*', function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Router: User API
app.post('/user/authenticate', userAPI.authenticate);

app.get('/user/:userId/check', userAPI.check);

app.post('/user/insert', userAPI.insert);
app.get('/user/:userId', userAPI.get);
app.put('/user/:userId', userAPI.update);
app.delete('/user/:userId', userAPI.deleteAccount);

app.get('/user/:userId/matches', userAPI.matches);
app.get('/user/:userId/match/:matchId', userAPI.match);

app.post('/user/:action', userAPI.createLink);

// Router: Feed API
app.get('/feed/:userId/:offset/:gender/:likeMen/:likeWomen/:latCoord/:longCoord/:searchRadius', feedAPI.feed);

// Router: Tools API
app.get('/tools/coords/:query', toolsAPI.coords);

// Express aan port 80 koppelen
server.listen('80', function() {
  console.log((new Date()) + "API and Websocket server staat aan yeah.");
});