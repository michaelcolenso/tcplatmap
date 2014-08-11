var secrets = require('../config/secrets');
var request = require('request');
var fs = require('fs');
var parser = require('JSONStream').parse('features.*.attributes')
var options = { db: secrets.db,  collection: 'tcsalesdata' };
var streamToMongo = require('stream-to-mongo')(options);

fs.createReadStream('salesdatatc.json').pipe(parser).pipe(streamToMongo);
//request("http://arcserver.tclp.org/arcgis/rest/services/City/CityParcelViewer/MapServer/2/query?where=objectid+%3D+objectid&outfields=*&f=json")
  //.pipe(parser)
  //.pipe(streamToMongo);
