var socket = io.connect('http://localhost:60013/providers');
var client = new IDBRemote.Client.Direct();
client.exposeDatabases(['b2g-calendar']);

socket.on('connect', function() {
  var proxy = new IDBRemote.Proxy.Socketio(client, socket);
  proxy.register(window.location.hostname, function() {
    console.log('MEME ------ READY -----');
  });
});
