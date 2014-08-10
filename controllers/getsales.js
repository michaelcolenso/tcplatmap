var request = require('request');
var parser = require('JSONStream').parse('features.*.attributes');
var fs = require('fs');
var db = process.env.MONGO_URL;
var sales = fs.createReadStream(__dirname + '/../sales.json');

var options = { db: db, collection: 'sales' };
var streamToMongo = require('stream-to-mongo')(options);

sales.pipe(parser).pipe(streamToMongo);
