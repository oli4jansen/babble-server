var FB         = require('fb');
var fs         = require('fs');
var mysql      = require('mysql');
var http       = require('http');
var gcm        = require('node-gcm');

// Dit zou naar een config file moeten
var connection = mysql.createConnection({
  host     : 'localhost',
  port     : '3306',
  user     : 'root',
  password : 'root'
});
connection.query('USE babble');

// Dit zou ook naar een config file moeten
var bingMapsKey = 'AsrEVvWtouDR82GoF9DjxzJuzBu9qOyytqtiApge__EnBY6YYZ22WuPvpgUPep56';

// Google Cloud Messaging opzetten
var GCMSender = new gcm.Sender('AIzaSyBYlL5hyNUA1rtwZwT30ZKb9zMXswA_AQk');

var authenticate = function(req, res) {
  console.log('API request > User API > authenticate');

  res.setHeader('Content-Type', 'application/json');

  // Checken of een gebruiker met dit ID al bestaat, zo ja, haal access token op
  connection.query('SELECT id FROM users WHERE id = ? AND signeduptimestamp = ?', [req.body.id, req.body.signeduptimestamp], function(err, rows, fields) {
    try {
      if (err) {
        throw err;
      }else{
        if(rows.length > 0) {

          res.send({status:200, data: {} });
          console.log('Ingelogd als '+FBres.id);

        }else{
          if(req.body.id !== undefined && req.body.name !== undefined && req.body.pictureList !== undefined && req.body.location !== undefined && req.body.gender !== undefined && req.body.birthdate !== undefined && req.body.description !== undefined && req.body.location !== undefined && req.body.location !== '') {

            // Coordinaten zijn nu nog leeg
            var latitude = '';
            var longitude = '';

            // Request maken naar VirtualEarth > locatie opgeven
            var request = http.request('http://dev.virtualearth.net/REST/v1/Locations?q='+ encodeURIComponent(req.body.location) + '&o=json&key='+bingMapsKey, function(response){
              var body = ""
              response.on('data', function(data) {
                body += data;
              });
              response.on('end', function() {
                // Zodra we reactie hebben > result parsen
                var result = JSON.parse(body);

                if(result.resourceSets[0].resources !== undefined && result.resourceSets[0].resources.length > 0) {
                  // Coordinaten eruit halen, als die gegeven zijn
                  latitude  = result.resourceSets[0].resources[0].point.coordinates[0];
                  longitude = result.resourceSets[0].resources[0].point.coordinates[1];

                  // Gegeven in users table invoeren
                  connection.query(
                  'INSERT INTO users (id, signeduptimestamp, name, birthdate, location, gender, pictureList, description, likeMen, likeWomen, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  [req.body.id, req.body.signeduptimestamp, req.body.name, req.body.birthdate, req.body.location, req.body.gender, req.body.pictureList, req.body.description, req.body.likeMen, req.body.likeWomen, latitude, longitude],
                  function(err, rows, fields) {
                    // Faal, stuur 500
                    if (err) {
                      console.log(err);
                      throw 'We\'re sorry but an error occurred on our server.';
                    }else{
                      console.log('Gebruiker '+req.body.id+' aangemaakt.');

                      // Gelukt, stuur 200
                      res.send({status: 200, data: {} });
                    }
                  });
                } else {
                  throw 'The location you provided wasn\'t an valid one.';
                }
              });
            });
            request.on('error', function(e) {
              throw e.message;
            });
            request.end();
          } else {
            throw 'Please provide us with a valid location. We can\'t find people near you if we don\'t know where you are.';
          }
        }
      }
    } catch(err) {
      if(request!== undefined) request.end();
      res.send({ status: 500, data: err });
    }
  });
};

// Checken of een gebruiker wel bestaat
var check = function(req, res){
  var userId = req.param("userId");

  console.log('API request > User API > check ('+userId+')');

  res.setHeader('Content-Type', 'application/json');

  connection.query('SELECT COUNT(id) AS count FROM users WHERE id = ?', [userId],function(err, rows, fields) {
    if (err) {
      res.send({count: 0});
    }else{
      res.send(rows[0]);
    }
  });
};

// Gebruiker info ophalen
var get = function(req, res){
  var userId = req.param("userId");

  console.log('API request > User API > get ('+userId+')');

  res.setHeader('Content-Type', 'application/json');

  connection.query('SELECT * FROM users WHERE id = ?', [userId],function(err, rows, fields) {
    if (err) {
      console.log(err);
      res.send({status: '404'});
    }else{
      try {
        res.send({ status: '200', data: rows});
      } catch(err) {
        console.log(err);
        res.send({status: '404'});
      }
    }
  });

};

// Matches v/e gebruiker ophalen
var matches = function(req, res){
  var userId = req.param("userId");

  console.log('API request > User API > matches ('+userId+')');

  res.setHeader('Content-Type', 'application/json');

  connection.query('SELECT DISTINCT u.name, u.id, u.pictureList, l.action FROM userLinksFinished l INNER JOIN users u ON ( u.id = l.userId1 AND l.userId2 = ? ) OR (u.id = l.userId2 AND l.userId1 = ?) WHERE l.action > 0', [userId, userId],function(err, rows, fields) {
    if (err) {
      console.log(err);
      res.send({status: '404'});
    }else{
      try {
        res.send({ status: '200', data: rows});
      } catch(err) {
        console.log(err);
        res.send({status: '404'});
      }
    }
  });

};

// Speicifieke match v/e gebruiker ophalen
var match = function(req, res){
  var userId = req.param("userId");
  var matchId = req.param("matchId");

  console.log('API request > User API > match ('+userId+' en '+matchId+')');

  res.setHeader('Content-Type', 'application/json');

  connection.query('SELECT DISTINCT u.name, u.id, u.pictureList, u.description, l.action FROM userLinksFinished l INNER JOIN users u ON ( u.id = l.userId1 AND l.userId2 = ? ) OR (u.id = l.userId2 AND l.userId1 = ?) WHERE l.action > 0 AND u.id = ?', [userId, userId, matchId],function(err, rows, fields) {
    if (err) {
      console.log(err);
      res.send({status: '500'});
    }else{
      try {
        res.send({ status: '200', data: rows});
      } catch(err) {
        console.log(err);
        res.send({status: '500'});
      }
    }
  });

};

// Gebruiker updaten
// PUT: {description, likeMen, likeWomen}
var update = function(req, res){
  console.log('API request > User API > update');

  var userId = req.param("userId");

  res.setHeader('Content-Type', 'application/json');
  try {
    if(req.body.description !== undefined && req.body.likeMen !== undefined && req.body.likeWomen !== undefined && req.body.searchRadius !== undefined) {

      console.log(req.body);
      // Proberen de data te updaten
      connection.query(
      'UPDATE users SET description = ?, likeMen = ?, likeWomen = ?, searchRadius = ? WHERE id = ?',
      [req.body.description, parseInt(req.body.likeMen), parseInt(req.body.likeWomen), parseInt(req.body.searchRadius), userId],
      function(err, rows, fields) {
        // Faal, gooi error
        if (err) throw err;

        // Gelukt, stuur 200
        res.send({status: '200'});
      });
    }else{
      // Foutieve PUT info: (HTTP) error 400
      res.send({status: '400'});
    }
  } catch(err) {
    // Probleem in het checken van shit: (HTTP) error 500
    res.send({status: '500'});
    console.log(err);
  }

};

// Gebruiker verwijderen uit DB
var deleteAccount = function(req, res){
  console.log('API request > User API > delete');

  var userId = req.param("userId");

  res.setHeader('Content-Type', 'application/json');
  try {
    connection.beginTransaction(function(err) {
      if (err) throw err;

      connection.query('DELETE FROM users WHERE id = ?', [userId], function(err, result) {
        if (err) {
          connection.rollback(function() {
            throw err;
          });
        }
        connection.query('DELETE FROM userLinksPending WHERE userIdLiked = ? OR userIdPending = ?', [userId, userId], function(err, result) {
          if (err) {
            connection.rollback(function() {
              throw err;
            });
          }
          connection.query('DELETE FROM userLinksFinished WHERE userId1 = ? OR userId2 = ?', [userId, userId], function(err, result) {
            if (err) {
              connection.rollback(function() {
                throw err;
              });
            }

            // TODO:
            // Delete photo's by user.
            // Delete chat messages by user.

            connection.commit(function(err) {
              if (err) {
                connection.rollback(function() {
                  throw err;
                });
              }
              res.send({status: '200'});
            });
          });
        });
      });
    });
  } catch(err) {
    res.send({status: '500'});
    console.log(err);
  }

};

var uploadPicture = function(req, res){
  res.setHeader('Content-Type', 'application/json');

  console.log('API request > User API > picture upload');

  // Access token die we ontvangen hebben van client instellen
  FB.setAccessToken(req.body.accessToken);

  // Een facebook graph api request maken
  FB.api('/me', { fields: ['id'] }, function(FBres){
    if(!FBres || FBres.error) {
      console.log(!FBres ? 'error occurred' : FBres.error);
      res.send({status: 500});
      return;
    }

    fs.readFile(req.files.file.path, function (err, data) {

      if(err) {
        console.log(err);
        res.send({status: '500'});
      }else{
        var newPath = __dirname+'/static/profile-pictures/'+FBres.id+'-'+req.files.file.originalFilename;

        fs.writeFile(newPath, data, function (err) {
          if(err) {
            console.log(err);
            res.send({status: '500'});
          }else{
            res.send({status: '200', location: 'http://www.oli4jansen.nl:81/profile-pictures/'+FBres.id+'-'+req.files.file.originalFilename});
          }
        });
      }
    });
  });
};

var updatePictureList = function(req, res){
  res.setHeader('Content-Type', 'application/json');

  console.log('API request > User API > picture list update');

  if(req.body.accessToken !== undefined && req.body.pictureList !== undefined) {
    var pictureList = JSON.parse(req.body.pictureList);
    if(pictureList instanceof Array) {
      // Access token die we ontvangen hebben van client instellen
      FB.setAccessToken(req.body.accessToken);

      // Een facebook graph api request maken
      FB.api('/me', { fields: ['id'] }, function(FBres){
        if(!FBres || FBres.error || FBres.id !== req.param("userId")) {
          console.log(!FBres ? 'error occurred' : FBres.error);
          res.send({status: 500});
          return;
        }

        // De nieuwe foto lijst in de database pushen
        connection.query('UPDATE users SET pictureList = ? WHERE id = ?', [req.body.pictureList, FBres.id],
        function(err, rows, fields) {
          if (err){
            console.log('MySQL error: '+err);
            // Faal, gooi error
            res.send({status: '500'});
          }else{
            // Gelukt, stuur 200
            res.send({status: '200'});
          }
        });
      });
    }else{
      res.send({status: '500'});
    }
  }else{
    res.send({status: '500'});
  }
};

var createLink = function(req, res){
  var action    = req.param("action");
  console.log('API request > User API > createLink > '+action);

  res.setHeader('Content-Type', 'application/json');
  try {
    if((action === 'like' || action === 'dislike') && req.body.userIdMe !== undefined && req.body.userIdHer !== undefined) {

      // TODO: checken of de users bestaan
      // Note: bovenstaande check misschien eens i/d zoveel tijd doen om de last bij dit API request te verkleinen

      switch(action) {
        case 'like':
          var actionInt = 1;
          break;
        case 'dislike':
          var actionInt = 0;
          break;
        default:
          var actionInt = 1;
      }

      // Checken of er al een userLinksPending row bestaat waarin ik pending sta.
      connection.query('SELECT COUNT(userIdLiked) AS c FROM userLinksPending WHERE userIdLiked = ? AND userIdPending = ?',
      [req.body.userIdHer, req.body.userIdMe],
      function(err, rows, fields) {
        // Faal, gooi error
        if (err) throw err;

        // Als: huidige gebruiker staat pending
        if(rows[0].c > 0) {
          // Transactie beginnen want we zowel willen deleten (pending) als inserten (finished)
            connection.beginTransaction(function(err) {
              if (err) throw err;

              connection.query('INSERT INTO userLinksFinished (userId1, userId2, action) VALUES (?, ?, ?)', [req.body.userIdMe, req.body.userIdHer, actionInt], function(err, result) {
                if (err) {
                  // Error tijdens inserten van userLinkFinished
                  connection.rollback(function() {
                    // Insert terugdraaien en een error gooien
                    throw err;
                  });
                }

                // Insert into userLinksFinished succesvol, nu uit userLinksPending verwijderen
                connection.query('DELETE FROM userLinksPending WHERE userIdLiked = ? AND userIdPending = ?', [req.body.userIdHer, req.body.userIdMe], function(err, result) {
                  if (err) {
                    // Error tijdens verwijderen
                    connection.rollback(function() {
                      // Insert en delete terugdraaien en een error gooien
                      throw err;
                    });
                  }
                  // Geen error: commit die shit
                  connection.commit(function(err) {
                    if (err) {
                      // Error tijdens commit
                      connection.rollback(function() {
                        // Toch maar terugdraaien en een error gooien
                        throw err;
                      });
                    }
                    // Die shit is gelukt yeah
                    res.send({status: '200', data: 'match'});

                    // Ook nog even een push notification sturen naar 'her'
                    var message = new gcm.Message({
                      collapseKey: 'BabbleMatch',
                      delayWhileIdle: true,
                      data: {
                        type: 'match',
                        title: req.body.myName+' and you matched!',
                        message: 'Click here to start chatting.',
                        herName: req.body.myName,
                        herId: req.body.userIdHer
                      }
                    });

                    // Reg ID ophalen
                    var sql = 'SELECT GCMRegId FROM users WHERE id = ?';
                    connection.query(
                      sql,
                      [req.body.userIdHer],
                      function(err, rows, fields) {
                        if(!err) {
                          // Versturen die handel
                          GCMSender.send(message, [ rows[0].GCMRegId ], 4, function (err, result) {
                            if(err) console.log(err);
                          });
                        }else{
                          console.log(err);
                        }
                      });
                  });
                });
              });
            });

        }else{
          switch(action) {
            case 'like':
              // De andere gebruiker heeft de aanvrager v/d like nog niet geliked. Balen.
              var sql = 'INSERT INTO userLinksPending (userIdLiked, userIdPending) VALUES (?, ?)';
              connection.query(sql,
              [req.body.userIdMe, req.body.userIdHer],
              function(err, rows, fields) {
                // Faal, stuur 500
                if (err) throw err;
                // Gelukt, stuur 200
                res.send({status: '200', data: 'pending'});
              });
              break;
            case 'dislike':
              // Ik sta niet pending en heb gedisliked: de ander zal mij nooit zien
              var sql = 'REPLACE INTO userLinksFinished (userId1, userId2, action) VALUES (?, ?, 0)';
              connection.query(sql,
              [req.body.userIdMe, req.body.userIdHer],
              function(err, rows, fields) {
                // Faal, stuur 500
                if (err) throw err;
                // Gelukt, stuur 200
                res.send({status: '200', data: 'finished'});
              });
              break;
          }
        }
      });
    }else{
      throw "Action '"+action+"' ongeldig."
    }
  } catch(err) {
    console.log(err);
    res.send({status: '500'})
  }
};

// Gebruiker's regid list updaten
// POST: {accessToken, regId}
var regid = function(req, res){
  res.setHeader('Content-Type', 'application/json');

  console.log('API request > User API > regid update');

  if(req.body.accessToken !== undefined && req.body.regId !== undefined) {
    // Access token die we ontvangen hebben van client instellen
    FB.setAccessToken(req.body.accessToken);

    // Een facebook graph api request maken
    FB.api('/me', { fields: ['id'] }, function(FBres){
      if(!FBres || FBres.error || FBres.id !== req.param("userId")) {
        console.log(!FBres ? 'error occurred' : FBres);
        res.send({status: 500});
      }else{
        // De nieuwe foto lijst in de database pushen
        connection.query('UPDATE users SET GCMRegID = ? WHERE id = ?', [req.body.regId, FBres.id],
        function(err, rows, fields) {
          if (err){
            console.log('MySQL error: '+err);
            // Faal, gooi error
            res.send({status: '500'});
          }else{
            // Gelukt, stuur 200
            res.send({status: '200'});
          }
        });
      }
    });
  }else{
    res.send({status: '500'});
  }
};

exports.authenticate      = authenticate;
exports.check             = check;
exports.matches           = matches;
exports.match             = match;
exports.get               = get;
exports.update            = update;
exports.updatePictureList = updatePictureList;
exports.deleteAccount     = deleteAccount;
exports.uploadPicture     = uploadPicture;
exports.createLink        = createLink;
exports.regid             = regid;