var http = require('http');

var coords = function(req, res){
  console.log('API request > Tools API > coords');
  res.setHeader('Content-Type', 'application/json');

  var query = req.param("query");

  var bingMapsKey = 'AsrEVvWtouDR82GoF9DjxzJuzBu9qOyytqtiApge__EnBY6YYZ22WuPvpgUPep56';

  var request = http.request('http://dev.virtualearth.net/REST/v1/Locations?q='+ encodeURIComponent(query) + '&o=json&key='+bingMapsKey, function(response){
    var body = ""
    response.on('data', function(data) {
      body += data;
    });
    response.on('end', function() {
      var result = JSON.parse(body);
      if(result.resourceSets[0].resources.length > 0) {
        res.send({ latitude: result.resourceSets[0].resources[0].point.coordinates[0], longitude: result.resourceSets[0].resources[0].point.coordinates[1] });
      } else {
        res.send(JSON.stringify({status: "404"}))
      }
    });
  });
  request.on('error', function(e) {
    console.log('Problem with request: ' + e.message);
    res.send(JSON.stringify({status: '500'}));
  });
  request.end();

};

exports.coords    = coords;