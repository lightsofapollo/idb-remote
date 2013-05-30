(function(exports, global) {
  var socketIO = global.io;
  if (typeof require === 'function') {
    socketIO = require('socket.io-client');
  }

  var PROXY_EVENTS = [
    'data',
    'error',
    'end'
  ];

  /**
   * Socket.io proxy manger. Communicates results back to server bridge.
   *
   *    var socket = io.connect('http://...');
   *    var client = new IDBRemote.Client.Direct();
   *
   *    var proxy = new IDBRemote.Proxy.Socketio(client, socket);
   *    proxy.register();
   *
   *
   * @constructor
   * @name Socketio
   * @param {IDBRemote.Client.*} client interface.
   * @param {Object} socket io client instance.
   */
  function Socketio(client, socket) {
    this.client = client;
    this.socket = socket;
  }

  Socketio.prototype = {
    /**
     * Register proxy with server.
     *
     *    // optional callback will return when server sends ack.
     *    proxy.register(function() {
     *      // yey server knows
     *    });
     *
     * @param {Function} [callback] optional will wait for server ack.
     */
    register: function(domain, callback) {
      if (typeof(domain) === 'function') {
        callback = domain;
        domain = null;
      }

      if (!domain) {
        if (typeof window !== 'undefined') {
          // domain is resolved in browser environments if not given
          domain = window.location.domain;
        } else {
          // but required for node environments
          return setTimeout(callback, 0, new Error('must pass domain argument'));
        }
      }

      this.client.databases(function(err, list) {
        if (err) {
          // can't register
          return callback(err);
        }

        var payload = {
          domain: domain,
          databases: list
        };

        this.socket.on('objectStores', this.proxyObjectStores.bind(this));
        this.socket.on('all', this.proxyAll.bind(this));
        this.socket.emit('register proxy', payload, callback);
      }.bind(this));
    },

    proxyObjectStores: function(database, callback) {
      this.client.objectStores(database, function(err, list) {
        if (err) {
          return callback(err);
        }
        callback(list);
      });
    },

    proxyAll: function(streamId, db, store, options) {
      var self = this;
      var stream = this.client.all(db, store, options);

      PROXY_EVENTS.forEach(function(type) {
        stream.on(type, function() {
          var content = [type].concat(Array.prototype.slice.call(arguments));
          self.socket.emit('stream', streamId, content);
        });
      });
    }
  };

  exports.Socketio = Socketio;

}).apply(
  this,
  typeof window === 'undefined' ?
    [module.exports, global] :
    [window.IDBRemote.Proxy, window]
);


