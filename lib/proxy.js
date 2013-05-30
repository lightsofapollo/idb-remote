(function() {

  if (typeof module === 'undefined') {
    window.IDBRemote.Proxy= {};
    return;
  }

  module.exports = {
    Socketio: require('./proxy/socketio').Socketio
  };

}());

