var mysql             = require('mysql');
var mysqlConnection   = mysql.createConnection({
  host     : 'localhost',
  port     : '3306',
  user     : 'root',
  password : 'root'
});
mysqlConnection.query('USE babble');

var nano              = require('nano')('http://127.0.0.1:5984');
var chats             = nano.db.use('chats');

var openConnections = new Array;

// Alle functies

var request = function(request) {
  console.log('API request > Chats API > request');

  // Verbinding met client accepteren
  var connection = request.accept(null, request.origin); 

  // Shit die ingesteld moet worden voordat gechat kan worden
  var myName = false;
  var herName = false;
  var validChat = false;
  var messageCounterInit = 25;
  var messageCounter = 25;

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

        openConnections[myName] = { connection: connection, smallest: Math.min(myName, herName), largest: Math.max(myName, herName) };

        console.log(openConnections);
        console.log(JSON.stringify(openConnections));

        mysqlConnection.query('SELECT action FROM userLinksFinished WHERE (userId1 = ? AND userId2 = ?) OR (userId1 = ? AND userId2 = ?)', [myName, herName, herName, myName], function(err, rows, fields) {
          if (err) {
            console.log(err);
          }else{
            if(rows[0].action > 0) {
              if(rows[0].action < 27) {
                // De counters opzetten, het te halen aantal berichten is nog niet gehaald.
                messageCounterInit = rows[0].action;
                messageCounter = rows[0].action;


                // De status van dit gesprek is fase 1
                var status = 'hidden';
              }else{
                var status = 'visible';
              }
              // Aan client bevestigen dat er verbinding gemaakt is
              connection.sendUTF(JSON.stringify({ type: 'status', data: status, counter: messageCounter }));

              console.log((new Date()) + ' ' + myName + ' opent chat met ' + herName + '.');

              // Document naam is het laagste ID + het hoogste ID van de twee chatters;
              // Bij 114056 die chat met 114904 zou de chatnaam zijn: '114056+114904'
              validChat = true;

              chats.view('chats', 'by_time?startkey=%5B'+Math.min(myName, herName)+','+Math.max(myName, herName)+',0%5D&endkey=%5B'+Math.min(myName, herName)+','+Math.max(myName, herName)+',9999999999999999999%5D', function(err, body) {
                if (!err) {
                  if(body.rows.length > 0) {
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
                console.log('Geschiedenis bevestigd en verwijderd.');
              }else{
                console.log(err);
              }
            });
          }
        }else{
          // Slechts 1 bericht bevestigd
          if(data.gotMessage.author === herName) {
            console.log('Bericht door '+data.gotMessage.author+' bevestigd door '+myName);

            chats.destroy(data.gotMessage.id, data.gotMessage.rev, function(err, body) {
              if(!err) {
                console.log('Bericht verwijderd.');
              }else{
                console.log(err);
              }
            });

          }else{
            console.log('Echter bevestigd door auteur zelf.');
          }
        }
      } else {
        if(validChat) {
          console.log(myName + ': ' + data);

          chats.insert({ body: message.utf8Data, author: myName, time: (new Date()).getTime(), smallest: Math.min(myName, herName), largest: Math.max(myName, herName) }, function(err, body) {
            if(err)
              console.log(err);
          });
        }
      }
    }
  });
 
  // Gebruiker sluit verbinding
  connection.on('close', function(connection) {
    console.log((new Date()) + ' ' + myName + ' is weg.');

    console.log(openConnections);
    openConnections.splice(myName, 1);
    console.log(openConnections);

    // Als er aan het begin van de connectie minder dan 26 berichten verstuurd waren, dan moeten we de database even updaten zodat de counter de volgende keer up-to-date is
    if(messageCounterInit < 27) {
      // update query
      mysqlConnection.query('UPDATE userLinksFinished SET action = ? WHERE (userId1 = ? AND userId2 = ?) OR (userId1 = ? AND userId2 = ?)', [messageCounter, myName, herName, herName, myName], function(err, rows, fields) {
        if (err) {
          console.log(err);
        }else{
          console.log('Message counter bijgewerkt naar '+messageCounter);
        }
      });
    }
  });
};

              // Nieuwe feed aanmaken die wijzigingen in de gaten houdt
              var feed = chats.follow();

              // Feed instellen
              feed.db            = "http://127.0.0.1:5984/chats";
              feed.since         = "now";
              feed.filter        = "_view";
              feed.view          = 'chats/by_time';
              feed.include_docs  = true;

              // Als er een wijziging is in de DB
              feed.on('change', function(change) {

                console.log('Change gedetecteerd');

                var possibleConnections  = new Array;
                var availableConnections = new Array;

                if(openConnections[change.doc.smallest] !== undefined) possibleConnections.push(change.doc.smallest);
                if(openConnections[change.doc.largest]  !== undefined) possibleConnections.push(change.doc.largest);

                console.log(possibleConnections);

                possibleConnections.forEach(function(con) {
                  if(openConnections[con].smallest === change.doc.smallest && openConnections[con].largest === change.doc.largest) {
                    availableConnections.push(con);
                  }
                });

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
                  });

//                  if(messageCounter < 27 && status === 'hidden') {
//                    messageCounter++;
//                    console.log('Send updated message counter: '+messageCounter);
//                    connection.sendUTF(JSON.stringify({ type: 'update', counter: messageCounter }));
//                  }

                }
              })
              feed.follow();

exports.request = request;