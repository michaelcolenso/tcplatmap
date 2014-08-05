var request = require('request');
var parser = require('JSONStream').parse('features.*.attributes')
var options = { db: 'mongodb://localhost:27017/tcsales', collection: 'docs' };
var streamToMongo = require('stream-to-mongo')(options);
var monk = require('monk');
var db = monk('localhost:27017/tcsales');
var collection = db.get('docs');




exports.index = function(req, res) {
  res.render('home', {
    title: 'Home'
  });
};

exports.getSales = function (req, res) {
  // request("http://arcserver.tclp.org/arcgis/rest/services/City/CityParcelViewer/MapServer/2/query?where=objectid+%3D+objectid&outfields=*&f=json")
  //   .pipe(parser)
  //   .pipe(streamToMongo);

  var pin = req.param('pin');
  console.log(pin);

  collection.findOne({ pnum: pin }, function (err, doc){
    console.log(doc);
  });


}
