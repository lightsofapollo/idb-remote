(function() {

  if (typeof module === 'undefined') {
    window.IDBRemote.Client = {};
    return;
  }

  module.exports = {
    Socketio: require('./client/socketio').Socketio
  };

}());
