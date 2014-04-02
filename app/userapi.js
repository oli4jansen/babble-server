var FB         = require('fb');
var mysql      = require('mysql');
var http       = require('http');
var connection = mysql.createConnection({
  host     : 'localhost',
  port     : '3306',
  user     : 'root',
  password : 'root'
});
connection.query('USE babble');

var bingMapsKey = 'AsrEVvWtouDR82GoF9DjxzJuzBu9qOyytqtiApge__EnBY6YYZ22WuPvpgUPep56';

var authenticate = function(req, res) {
  console.log('API request > User API > authenticate');

  res.setHeader('Content-Type', 'application/json');

  try {    
    // Access token die we ontvangen hebben van client instellen
    FB.setAccessToken(req.body.accessToken);

    // Een facebook graph api request maken
    FB.api('/me', { fields: ['id', 'first_name', 'location', 'gender', 'picture.type(large)'] }, function(FBres){
      if(!FBres || FBres.error) {
        console.log(!FBres ? 'error occurred' : FBres.error);
        res.send({status: 500});
        return;
      }

      // Checken of een gebruiker met dit ID al bestaat, zo ja, haal access token op
      connection.query('SELECT accessToken FROM users WHERE id = ?', [FBres.id], function(err, rows, fields) {
        if (err) {
          throw err;
        }else{
          if(rows.length > 0) {
            // Alvast status 200 terugkeren zodat de client verder kan
            res.send({status:200, data: {id:FBres.id}});
            console.log('Ingelogd als '+FBres.id);

            // Als de access token uit de DB niet gelijk is aan de opgegeven access token:
            if(rows[0].accessToken !== req.body.accessToken) {
              // Access token updaten
              connection.query('UPDATE users SET accessToken = ? WHERE id = ?', [req.body.accessToken, FBres.id], function(err, rows, fields) {  
                // Faal, gooi error
                if (err) throw err;
              });
            }

          }else{
            if(FBres.id !== undefined && FBres.first_name !== undefined && req.body.location !== undefined && FBres.gender !== undefined && req.body.birthday !== undefined && req.body.description !== undefined) {
              // Foto URL opstellen
              var picture = 'http://graph.facebook.com/'+FBres.id+'/picture?width=600&height=600';

              // Coordinaten ophalen op basis van locatie
              var latitude = '';
              var longitude = '';

              var request = http.request('http://dev.virtualearth.net/REST/v1/Locations?q='+ encodeURIComponent(req.body.location) + '&o=json&key='+bingMapsKey, function(response){
                var body = ""
                response.on('data', function(data) {
                  body += data;
                });
                response.on('end', function() {
                  var result = JSON.parse(body);
                  if(result.resourceSets[0].resources.length > 0) {
                    latitude  = result.resourceSets[0].resources[0].point.coordinates[0];
                    longitude = result.resourceSets[0].resources[0].point.coordinates[1];

                    // Gegeven in users table invoeren
                    connection.query(
                    'INSERT INTO users (id, accessToken, name, birthday, location, gender, picture, description, likeMen, likeWomen, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [FBres.id, req.body.accessToken, FBres.first_name, req.body.birthday, req.body.location, FBres.gender, picture, req.body.description, req.body.likeMen, req.body.likeWomen, latitude, longitude],
                    function(err, rows, fields) {  
                      // Faal, stuur 500
                      if (err) {
                        throw err;
                      }else{
                        console.log('Gebruiker '+FBres.id+' aangemaakt.');

                        // Gelukt, stuur 200
                        res.send({status: 200, data: {id:FBres.id}});
                      }
                    });
                  } else {
                    // TODO: popup scherm met plaats
                    throw 'Couldn\'t find coords.';
                  }
                });
              });
              request.on('error', function(e) {
                throw e.message;
              });
              request.end();

            } else {
              console.log('Niet alle data ingevoerd, vraag om de rest.');

              var location = '';
              if(FBres.location !== undefined && FBres.location.name !== undefined) location = FBres.location.name;

              res.send({
                status: 206,
                data: {
                  id: FBres.id,
                  name: FBres.first_name,
                  picture: 'http://graph.facebook.com/'+FBres.id+'/picture?width=600&height=600',
                  accessToken: req.body.accessToken,
                  location: location
                }
              });

            }
          }
        }
      });
    });
  }catch(err){
    console.log(err);
    res.send({status: 500});
  }
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

  connection.query('SELECT DISTINCT u.name, u.id, u.picture, l.action FROM userLinksFinished l INNER JOIN users u ON ( u.id = l.userId1 AND l.userId2 = ? ) OR (u.id = l.userId2 AND l.userId1 = ?) WHERE l.action > 0', [userId, userId],function(err, rows, fields) {
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

  connection.query('SELECT DISTINCT u.name, u.id, u.picture, u.description, l.action FROM userLinksFinished l INNER JOIN users u ON ( u.id = l.userId1 AND l.userId2 = ? ) OR (u.id = l.userId2 AND l.userId1 = ?) WHERE l.action > 0 AND u.id = ?', [userId, userId, matchId],function(err, rows, fields) {
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

        if(rows[0].c > 0) {
          // Huidige gebruiker staat pending
          // Transactie beginnen want we willen deleten (pending) en inserten (finished) tegelijk
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

                    

                    // TODO: Push notification versturen naar 'her'



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
              var sql = 'INSERT INTO userLinksFinished (userId1, userId2, action) VALUES (?, ?, 0)';
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


exports.authenticate  = authenticate;
exports.check         = check;
exports.matches       = matches;
exports.match         = match;
exports.get           = get;
exports.update        = update;
exports.deleteAccount = deleteAccount;
exports.createLink    = createLink;