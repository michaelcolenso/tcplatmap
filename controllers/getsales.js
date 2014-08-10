var request = require('request');
var parser = require('JSONStream').parse('features.*.attributes');
var db = process.env.MONGO_URL;
var fs = require('fs');

var options = { db: db, collection: 'sales' };
var streamToMongo = require('stream-to-mongo')(options);

var file = fs.createReadStream('/sales.json');
console.log(file);

file.pipe(parser).pipe(streamToMongo);
