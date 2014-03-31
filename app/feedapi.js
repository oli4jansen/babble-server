var FB         = require('fb');
var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : '127.0.0.1',
  port     : '8889',
  user     : 'root',
  password : 'root'
});
connection.query('USE tinderpro');

var feed = function(req, res){
  var offset        = req.param("offset");

  var userId        = req.param("userId");
  var gender        = req.param("gender");
  var likeMen       = req.param("likeMen");
  var likeWomen     = req.param("likeWomen");
  var latCoord      = req.param("latCoord");
  var longCoord     = req.param("longCoord");
  var searchRadius  = req.param("searchRadius");

  console.log('API request > Feed API > feed (offset:'+offset+')');

  try {
    var accessToken   = req.body.accessToken;

    res.setHeader('Content-Type', 'application/json');

    var sqlAddition = '';
    if(likeMen === '1' && likeWomen === '0') {
      sqlAddition = ' AND users.gender = "male"';
    }else if(likeMen === '0' && likeWomen === '1') {
      sqlAddition = ' AND users.gender = "female"';
    }

    if(gender === 'male') {
      sqlAddition = sqlAddition + ' AND users.likeMen = 1';
    }else{
      sqlAddition = sqlAddition + ' AND users.likeWomen = 1';
    }

  //  console.log(sqlAddition);

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

  //  console.log(sql);

    connection.query(sql, [latCoord, longCoord, userId, userId, userId, searchRadius, searchRadius, searchRadius, searchRadius, userId],function(err, rows, fields) {
      if (err) throw err;
      if(rows) {
        // Er zijn personen gevonden

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
        throw "No rows";
      }
    });
  } catch(err) {
    console.log(err);
    res.send({status: '500', data: []});
  }
};

exports.feed    = feed;