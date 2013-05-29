(function(exports, global) {
  var socketIO = global.io;
  var Emitter = global.EventEmitter2;

  if (typeof require === 'function') {
    socketIO = require('socket.io-client');
    Emitter = require('eventemitter2').EventEmitter2;
  }

  /**
   * Special socket.io constructor on top of the client interface.
   *
   *    var socket = io.connect('http://...');
   *    var client = new IDBRemote.Client.Socketio(socket);
   *
   *
   * @constructor
   * @name Socketio
   * @param {Object} socket io client instance.
   */
  function Socketio(socket) {
    this.socket = socket;
    this.socket.on('stream', this._handleStream.bind(this));

    /**
     * Streams by id each instance is an EventEmitter2
     */
    this.streams = {};
  }

  Socketio.prototype = {
    _disconnectStream: function(stream) {
      var err = new Error('socket has been closed or disconnected');
      stream.emit('error', err);
    },

    _handleStream: function(id, event) {
      var type = event[0];
      var stream = this.streams[id];
      if (stream) {
        stream.emit.apply(stream, event);
      }

      if (type === 'end' || type === 'error') {
        delete this.streams[id];
      }
    },

    databases: function(callback) {
      this.socket.emit('databases', callback);
    },

    objectStores: function(database, callback) {
      this.socket.emit('objectStores', database, callback);
    },

    all: function(database, store, options) {
      var emitter = new Emitter();

      // cleanup socket on disconnect
      this.socket.once('disconnect', function() {
        var id = emitter._streamId;
        if (id) {
          delete this.streams[id];
        }
        this._disconnectStream(emitter);
      }.bind(this));

      this.socket.emit('all', database, store, options, function(id) {
        this.streams[id] = emitter;
        emitter._streamid = id;
      }.bind(this));

      return emitter;
    }
  };

  exports.Socketio = Socketio;

}).apply(
  this,
  typeof window === 'undefined' ?
    [module.exports, global] :
    [window.IDBRemote.Client, window]
);

