var http            = require('http');
var express         = require('express');
var webSocketServer = require('websocket').server;
var nano            = require('nano')('http://127.0.0.1:5984');

// De verschillende APIs bevinden zich in verschillende modules
var userAPI         = require('./app/userapi');
var feedAPI         = require('./app/feedapi');
var chatAPI         = require('./app/chatapi');

// Express app aanmaken
var app             = express();

// HTTP server opzetten
var server          = http.createServer(app);

// Websocket server opzetten
var wsServer        = new webSocketServer({ httpServer: server });

// JSON bodies toestaan
app.use(express.json());

// Tijdelijk: document server om de client te dienen
app.use(express.static(__dirname + '/../client/angular/'));

app.configure(function(){
  app.use(express.methodOverride());
  app.use(express.multipart());
});


/*
 *	ROUTER
 */

// Websocket request
wsServer.on('request', chatAPI.request);

// HTTP requests zijn vanaf elk domein toegestaan
app.all('*', function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.get('/', function(req, res){
	res.send('API server voor Babble. Doei.');
});

// User API request
app.post('/user/authenticate', userAPI.authenticate);

app.get('/user/:userId/check', userAPI.check);

app.get('/user/:userId', userAPI.get);
app.put('/user/:userId', userAPI.update);
app.delete('/user/:userId', userAPI.deleteAccount);

app.post('/user/:userId/picture', userAPI.uploadPicture);

app.get('/user/:userId/matches', userAPI.matches);
app.get('/user/:userId/match/:matchId', userAPI.match);

app.post('/user/:action', userAPI.createLink);

// Feed API request
app.post('/feed/:userId/:offset/:gender/:likeMen/:likeWomen/:latCoord/:longCoord/:searchRadius', feedAPI.feed);

// Express aan port 80 koppelen
server.listen('80', function() {
  console.log((new Date()) + "API and Websocket server staat aan yeah.");
});
