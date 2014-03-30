var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : '127.0.0.1',
  port     : '8889',
  user     : 'root',
  password : 'root'
});
connection.query('USE tinderpro');

var feed = function(req, res){
  var offset    = req.param("offset");

  var userId        = req.param("userId");
  var gender        = req.param("gender");
  var likeMen       = req.param("likeMen");
  var likeWomen     = req.param("likeWomen");
  var latCoord      = req.param("latCoord");
  var longCoord     = req.param("longCoord");
  var searchRadius  = req.param("searchRadius");

  console.log('API request > Feed API > feed');

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
    try {
      if (err) throw err;
      if(rows) {
        res.send({ status: '200', data: rows});
//        console.log(rows);
      }else{
        throw "No rows";
      }
    } catch(err) {
      console.log(err);
      res.send({status: '404'});
    }
  });
};

exports.feed    = feed;