/**
 * WebSocket based proxy server.
 *
 * Proxy (Provider) Connection:
 *
 *  [
 *    'register proxy',
 *    {
 *      databases: [],
 *      objectStores: []
 *    }
 *  ]
 *
 * Client Sends:
 *
 *  [
 *    24 // opaque response id
 *    ['command', 'arg', 'arg']
 *  ]
 *
 * Commands:
 *
 *    databases: // without arguments sends all databases for all clients
 *    databases: ['domain'] // all databases for given domain
 *    all: ['domain@db', 'store']
 *    refresh: ['domain'] // refresh whole domain
 *    refresh: ['domain@db'] // refresh single db
 */

var EventEmitter = require('events').EventEmitter;

function send(client, data) {
  if (typeof data === 'object') {
    data = JSON.stringify(data);
  }
  return client.send(data);
}

var EVENTS = [
  'connection'
];

function Bridge(server) {
  EventEmitter.call(this);

  this.server = server;
  this.server.on('connection', this._onConnection.bind(this));

  /**
   * Table of all content providers.
   * One provider per domain.
   */
  this.providers = {};
}

Bridge.prototype = {
  __proto__: EventEmitter.prototype,

  broadcast: function(msg) {
    this.server.clients.forEach(function(client) {
      send(client, msg);
    });
  },

  handleCommand: function(client, command) {
    var type = command[0];

    switch (type) {
      case 'register proxy':
        this.handleRegisterProxy(client, command[1]);
        break;
    }
  },

  handleRegisterProxy: function(client, provider) {
    if (!provider.domain) {
      return send(
        client,
        [
          'error',
          'command: register proxy must contains .domain'
        ]
      );
    }

    // stringify now so we can mutate provider
    var broadcast = JSON.stringify(['register proxy', provider]);

    provider.ws = client;
    this.providers[provider.domain] = provider;

    // cleanup registered providers once they disconnect
    client.once('close', this._unregisterProxy.bind(this, provider.domain));
    this.emit('register proxy', provider);
    this.broadcast(broadcast);
  },

  _unregisterProxy: function(domain) {
    delete this.providers[domain];
    this.emit('unregister proxy', domain);
    this.broadcast(['unregister proxy', domain]);
  },

  _onMessage: function(client, data, flags) {
    if (flags.binary) {
      // we can't handle binary requests yet
      return;
    }

    var command = JSON.parse(data);
    this.handleCommand(client, command);
  },

  _onConnection: function(con) {
    var origin = con.upgradeReq.headers.origin;
    if (!origin) {
      return con.terminate();
    }

    con.on('message', this._onMessage.bind(this, con));
  }
};

module.exports = Bridge;
