var Firebase = require('firebase');
var jotfeed = new Firebase('boiling-fire-2926.firebaseIO.com/connections');
var request = require('request');

exports.index = function(req, res) {
  res.render('home', {
    title: 'Home'
  });
};
