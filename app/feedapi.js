// Alle nodige modules includen en verbindingen instellen
var FB         = require('fb');
var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : 'localhost',
  port     : '3306',
  user     : 'root',
  password : 'root'
});
connection.query('USE babble');

// Functie de de feed ophaalt voor een bepaalde gebruiker
var feed = function(req, res){
  // Offset wordt ingesteld als de feed wordt opgehaald terwijl er nog cards aanwezig zijn in de client
  var offset        = req.param("offset");

  // Andere variabelen die uit de URL gehaald kunnen worden
  var userId        = req.param("userId");
  var gender        = req.param("gender");
  var likeMen       = req.param("likeMen");
  var likeWomen     = req.param("likeWomen");
  var latCoord      = req.param("latCoord");
  var longCoord     = req.param("longCoord");
  var searchRadius  = req.param("searchRadius");

  // Loggen dat deze functie uitgevoerd wordt
  console.log('API request > Feed API > feed (offset:'+offset+')');

  try {
    // Access token uit de POST data ophalen
    var accessToken   = req.body.accessToken;

    // Header instellen zodat we JSON kunnen outputten
    res.setHeader('Content-Type', 'application/json');

    var sqlAddition = '';
    // Op basis van seksuele voorkeur de SQL aanpassen
    if(likeMen === '1' && likeWomen === '0') {
      sqlAddition = ' AND users.gender = "male"';
    }else if(likeMen === '0' && likeWomen === '1') {
      sqlAddition = ' AND users.gender = "female"';
    }

    // Op basis van geslacht de SQL aanpassen
    if(gender === 'male') {
      sqlAddition = sqlAddition + ' AND users.likeMen = 1';
    }else{
      sqlAddition = sqlAddition + ' AND users.likeWomen = 1';
    }

    // De almachtige SQL query
    var sql = 'SELECT id, name,'+
      ' 111.045* DEGREES(ACOS(COS(RADIANS(latpoint)) * COS(RADIANS(latitude))'+
      ' * COS(RADIANS(longpoint) - RADIANS(longitude))'+
      ' + SIN(RADIANS(latpoint))'+
      ' * SIN(RADIANS(latitude)))) AS distance,'+
      ' latitude,'+
      ' longitude,'+
      ' DATE_FORMAT( FROM_DAYS( DATEDIFF( NOW( ) , birthday ) ) ,  "%Y" ) +0 AS age,'+
      ' description'+
    ' FROM users'+
    ' JOIN ('+
    '   SELECT  ? AS latpoint,  ? AS longpoint'+
    ' ) AS p'+
    ' LEFT JOIN userLinksFinished AS l'+
    '   ON ( users.id = l.userId1 AND l.userId2 = ? ) OR ( users.id = l.userId2 AND l.userId1 = ? )'+
    ' LEFT JOIN userLinksPending AS p ON ( users.id = p.userIdPending AND p.userIdLiked = ? ) '+
    ' WHERE'+
    '   l.userId1 is null'+
    '   AND p.userIdPending is null'+
    '   AND users.latitude  BETWEEN latpoint - (? / 111.045)'+
    '         AND latpoint + (? / 111.045)'+
    '   AND users.longitude '+
    '         BETWEEN longpoint - (? / (111.045 * COS(RADIANS(latpoint))))'+
    '         AND longpoint + (? / (111.045 * COS(RADIANS(latpoint))))'+
    '   AND users.id != ?'+
     sqlAddition+
    ' ORDER BY distance'+
    ' LIMIT 10 OFFSET '+offset;

    // Die shit uitvoeren, vraagtekens vervangen door de params
    connection.query(sql, [latCoord, longCoord, userId, userId, userId, searchRadius, searchRadius, searchRadius, searchRadius, userId],function(err, rows, fields) {
      if (err) throw err;
      // Als er personen gevonden zijn
      if(rows !== undefined && rows.length > 0) {
        // Stel de Facebook AccessToken in
        FB.setAccessToken(accessToken);

        // Een lege array aanmaken voor de batch API call naar de Facebook Graph API
        var batch = [];

        // Voor elk resultaat een API call aan de batch toevoegen
        rows.forEach(function(row) {
          // me/mutualfriends/id geeft de mutual friends van 'me' (provider van accessToken) en het opgegeven id.
          batch.push({ method: 'get', relative_url: 'me/mutualfriends/'+row.id });
        });

        // Facebook API call maken
        FB.api('', 'post', { batch: batch }, function(FBres) {
          // Als er een error is..
          if(!FBres || res.error) {
            if(!FBres){
              throw 'error occurred'
            }else{
              throw FBres.error
            }
          }

          // Elk resultaat langsgaan en toevoegen aan het eind resultaat
          for(var i=0;i<FBres.length;i++) {
            rows[i].mutualFriends = JSON.parse(FBres[i].body).data;
          }

          // De data teruggeven aan de client
          res.send({ status: '200', data: rows});
        });
      }else{
        // Geen gebruikers gevonden, stuur 404
        res.send({status: '404', data: []});
      }
    });
  } catch(err) {
    // Als er een error is, loggen en status 500 outputten
    console.log(err);
    res.send({status: '500', data: []});
  }
};

exports.feed    = feed;