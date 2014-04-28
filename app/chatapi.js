// CONFIG
var nano              = require('nano')('http://127.0.0.1:5984');
var mysql             = require('mysql');
var gcm               = require('node-gcm');
var chats             = nano.db.use('chats');
var mysqlConnection   = mysql.createConnection({
  host     : 'localhost',
  port     : '3306',
  user     : 'root',
  password : 'root'
});
mysqlConnection.query('USE babble');

// Feed met chat database instellen
var feed = chats.follow();
feed.db            = "http://127.0.0.1:5984/chats";
feed.since         = "now";
feed.filter        = "_view";
feed.view          = 'chats/by_time';
feed.include_docs  = true;

// Google Cloud Messaging opzetten
var GCMSender = new gcm.Sender('AIzaSyBYlL5hyNUA1rtwZwT30ZKb9zMXswA_AQk');


// Algemene lijst met alle open connecties
var openConnections = {};

// Voor elke request wordt het volgende uitgevoerd
var request = function(request) {
  console.log('API request > Chats API > request');

  // Verbinding met client accepteren
  var connection = request.accept(null, request.origin);

  // Shit die ingesteld moet worden voordat gechat kan worden
  var myName = false;
  var herName = false;
  var validChat = false;
  var messageCounterInit = 1;
  var messageCounter = 1;

  // Als er een bericht verstuurd is:
  connection.on('message', function(message) {
    if (message.type === 'utf8') { // Alleen tekst accepteren

      try {
        var data = JSON.parse(message.utf8Data);
      } catch(e) {
        var data = message.utf8Data;
      }
      // Naam is leeg; dus er moet nog geregistreerd worden.
      // Eerste bericht is registratie bericht:
      if (myName === false) {

        myName = data.myName; // naam van degene die verbinding maakt
        herName = data.herName; // naam van de chatpartner

        mysqlConnection.query('SELECT action FROM userLinksFinished WHERE (userId1 = ? AND userId2 = ?) OR (userId1 = ? AND userId2 = ?)', [myName, herName, herName, myName], function(err, rows, fields) {
          if (err) {
            console.log(err);
          }else{
            if(rows[0].action > 0) {
              if(rows[0].action < 27) {
                // De counter opzetten, het te halen aantal berichten is nog niet gehaald.
                messageCounterInit = rows[0].action;

                // De status van dit gesprek is fase 1
                var status = 'hidden';
              }else{
                var status = 'visible';
              }
              // Aan client bevestigen dat er verbinding gemaakt is
              connection.sendUTF(JSON.stringify({ type: 'status', data: status, counter: messageCounterInit }));

              console.log(myName + ': ONLINE: chat met ' + herName);

              openConnections[ myName ] = { connection: connection, smallest: Math.min(myName, herName), largest: Math.max(myName, herName), messageCounter: rows[0].action, status: status };

              // Document naam is het laagste ID + het hoogste ID van de twee chatters;
              // Bij 114056 die chat met 114904 zou de chatnaam zijn: '114056+114904'
              validChat = true;

              chats.view('chats', 'by_time?startkey=%5B'+Math.min(myName, herName)+','+Math.max(myName, herName)+',0%5D&endkey=%5B'+Math.min(myName, herName)+','+Math.max(myName, herName)+',9999999999999999999%5D', function(err, body) {
                if (!err) {
                  if(body.rows.length > 0 && body.rows[body.rows.length-1].value.author !== myName) {
                    var messages = [];
                    body.rows.forEach(function(doc) {
                      var obj = {
                        id: doc.value._id,
                        rev: doc.value._rev,
                        time: (new Date(doc.value.time)).getTime(),
                        text: doc.value.body,
                        author: doc.value.author
                      };
                      messages.push(obj);
                    });
                    var history = JSON.stringify({ type:'history', data: messages });
                    connection.sendUTF(history);
                  }
                }else{
                  console.log(err);
                }
              });
            }else{
              console.log('WARNING: Chat declined, possible hacker?');
              connection.sendUTF(JSON.stringify({ type: 'status', data: 'declined' }));
            }
          }
        });
      } else if(typeof data !== 'string') {
        if(data.gotMessage instanceof Array) {
          // TODO: checken of dit er niet voor zorgt dat er berichten achterblijven in de database.
          if(data.gotMessage[data.gotMessage.length-1].author === herName) {
            var docsToDelete = {"docs": []};

            data.gotMessage.forEach(function(doc) {
              docsToDelete.docs.push({ "_id": doc.id, "_rev": doc.rev, "_deleted": true });
            });

            // TODO: delete all messages according to data.gotMessage
            chats.bulk(docsToDelete, function(err, body) {
              if(!err) {
                console.log('BEVESTIGD: geschiedenis');
              }else{
                console.log(err);
              }
            });
          }
        }else{
          // Slechts 1 bericht bevestigd
          if(data.gotMessage.author === herName) {
            console.log('BEVESTIGD: door '+myName);

            chats.destroy(data.gotMessage.id, data.gotMessage.rev, function(err, body) {
              if(!err) {
                console.log('DATABASE: bericht verwijderd');
              }else{
                console.log(err);
              }
            });

          }else{
            console.log('BEVESTIGD: door '+myName+' (auteur)');
          }
        }
      } else {
        if(validChat) {
          console.log(myName + ': SAYS: ' + data);

          chats.insert({ body: message.utf8Data, author: myName, time: (new Date()).getTime(), smallest: Math.min(myName, herName), largest: Math.max(myName, herName) }, function(err, body) {
            if(err) {
              console.log(err);
            }else{
              // TODO: checken of deze gebruiker niet al online is, dan hoeft er geen notification verstuurd te worden

              var message = new gcm.Message({
                  collapseKey: 'BabbleChat',
                  delayWhileIdle: true,
                  timeToLive: 3,
                  data: {
                      type: 'chat',
                      herId: herName,
                      herName: 'unknown',
                      title: 'You\'ve got a message!',
                      message: 'An unknown person sent you a message.'
                  }
              });

              var registrationIds = [];
              registrationIds.push('APA91bGZK8JRnJ3OZwy4aQnG4Q7BZsKCOEkH0o9wNtPbTH2AmUj__JBStL0kcXRaPDtHPtTAPVE9PYPdjbrGgKr2OI-w-YE9dXIB80H2Ry1KoO9L_8kqCNx39d6BFhAmv7EzM026NMk98a9KUp5Y_FhbchfBz1ov7g');

              GCMSender.send(message, registrationIds, 4, function (err, result) {
                if(err) console.log(err);
              });
            }
          });
        }
      }
    }
  });

  // Gebruiker sluit verbinding
  connection.on('close', function(connection) {
    console.log(myName + ': OFFLINE: chat met ' + herName);


    // Als er aan het begin van de connectie minder dan 26 berichten verstuurd waren, dan moeten we de database even updaten zodat de counter de volgende keer up-to-date is
    if(messageCounterInit < 27) {
      console.log('MessageCounterInit < 27');
      // update query
      mysqlConnection.query('UPDATE userLinksFinished SET action = ? WHERE (userId1 = ? AND userId2 = ?) OR (userId1 = ? AND userId2 = ?)', [openConnections[myName].messageCounter, myName, herName, herName, myName], function(err, rows, fields) {
        if (err) {
          console.log(err);
        }else{
          console.log('MySQL: counter bijgewerkt van '+messageCounterInit+' naar '+openConnections[myName].messageCounter);
        }
        delete openConnections[myName];
      });
    }

  });
};

// Als er een wijziging is in de DB
feed.on('change', function(change) {
  if(change.deleted === undefined) {
    console.log('DATABASE: Change detected');

    console.log(change);

    var possibleConnections  = new Array;
    var availableConnections = new Array;

    if(openConnections[change.doc.smallest] !== undefined) possibleConnections.push(change.doc.smallest);
    if(openConnections[change.doc.largest]  !== undefined) possibleConnections.push(change.doc.largest);

    possibleConnections.forEach(function(con) {
      if(openConnections[con].smallest === change.doc.smallest && openConnections[con].largest === change.doc.largest) {
        availableConnections.push(con);
      }
    });

    console.log('Online personen:');
    console.log(availableConnections);

    if(availableConnections.length > 0) {
      // Dan parsen we dat
      var obj = {
        id: change.doc._id,
        rev: change.doc._rev,
        time: (new Date()).getTime(),
        text: change.doc.body,
        author: change.doc.author
      };
      var json = JSON.stringify({ type:'message', data: obj });

      console.log('Change in DB:');
      console.log(json);
      // En pushen we dat naar de huidige verbinding
      availableConnections.forEach(function(con) {
        openConnections[con].connection.sendUTF(json);

        if(openConnections[con].messageCounter < 27) {
          openConnections[con].messageCounter++;
          openConnections[con].connection.sendUTF(JSON.stringify({ type: 'update', counter: openConnections[con].messageCounter }));
        }
      });

    }
  }
})
feed.follow();

exports.request = request;
