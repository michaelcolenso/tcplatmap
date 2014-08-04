var request = require('request');
var fs = require('fs');

request("http://arcserver.tclp.org/arcgis/rest/services/City/CityParcelViewer/MapServer/2/query?where=objectid+%3D+objectid&outfields=*&f=json")
  .pipe(fs.createWriteStream("public/js/salesdatatc.json"));
