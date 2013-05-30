var IDBRemote = require('../lib/index.js');
var socket = require('socket.io-client').connect('http://localhost:60013/clients');
var client = new IDBRemote.Client.Socketio(socket);

console.log('!!');
client.databases(function(err, list) {
  var db = list[0];

  client.objectStores(db, function(err, stores) {
    var ee = client.all(db, 'events');
    ee.on('data', function(item) {
      console.log(item);
    });
  });
});
