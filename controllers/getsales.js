var request = require('request');
var parser = require('JSONStream').parse('features.*.attributes');
var dburl = process.env.MONGO_URL;
var fs = require('fs');

var options = { db: dburl, collection: 'sales' };
var streamToMongo = require('stream-to-mongo')(options);

var file = fs.createReadStream('/sales.json');
file.pipe(parser).pipe(streamToMongo);
