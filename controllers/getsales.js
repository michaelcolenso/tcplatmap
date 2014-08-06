var request = require('request');
var parser = require('JSONStream').parse('features.*.attributes')
var options = { db: 'mongodb://localhost:27017/tcsales', collection: 'sales' };
var streamToMongo = require('stream-to-mongo')(options);

// request("http://arcserver.tclp.org/arcgis/rest/services/City/CityParcelViewer/MapServer/2/query?where=objectid+%3D+objectid&outfields=*&f=json")
//   .pipe(fs.createWriteStream("public/js/salesdatatc.json"));


request("http://arcserver.tclp.org/arcgis/rest/services/City/CityParcelViewer/MapServer/2/query?where=objectid+%3D+objectid&outfields=*&f=json")
  .pipe(parser)
  .pipe(streamToMongo);
