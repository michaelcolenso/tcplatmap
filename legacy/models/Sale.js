var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');
var crypto = require('crypto');

var saleSchema = new mongoose.Schema({

});

module.exports = mongoose.model('Sale', saleSchema);
