/**
 * WebSocket based proxy server.
 *
 * Proxy (Provider) Connection:
 *
 *  [
 *    'register proxy',
 *    {
 *      databases: {
 *        name: {
 *          name: 'name',
 *          objectStores: []
 *        }
 *      },
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
 *    objectStores: ['doman@db'] // fetch all objectStores for a given domain/db
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

/**
 * Issue a response to a specific request.
 *
 *
 *    response(socket, socketSentId, ['databases', ...]);
 *
 *
 * @param {WebSocket} client target of response.
 * @param {String} id opaque identifier for request.
 * @param {Object} data to send to client.
 */
function response(client, id, data) {
  return send(client, ['response ' + id, data]);
}

// used to split the domain from database name.
var DB_SEPERATOR = '@';

Bridge.DB_SEPERATOR = DB_SEPERATOR;

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
    var type = command.shift();

    switch (type) {
      case 'request':
        return this.handleRequest(client, command[0], command[1]);
      case 'register proxy':
        return this.handleRegisterProxy(client, command[0]);
      default:
        return this.emit(type, command);
    }
  },

  handleRequest: function(client, id, payload) {
    var type = payload.shift();
    switch (type) {
      case 'objectStores':
        return this.handleObjectStores(client, id, payload);
      case 'databases':
        return response(client, id, this._aggregateDatabases());
    }
  },

  handleObjectStores: function(client, id, payload) {
    // find the provider
    var owner = this.extractDb(payload[0]);
    if (!owner.database || !owner.domain) {
      return send(
        client,
        ['response ' + id, ['error', 'missing db or domain']]
      );
    }

    var provider = this.providers[owner.domain];
    if (!provider) {
      return send(
        client,
        ['response ' + id, ['error', 'no provider for domain: ' + owner.domain]]
      );
    }

    // proxy the response to client
    this.once('response ' + id, function(paylaod) {
      return send(client, ['response ' + id, paylaod[0]]);
    });

    // proxy request to provider
    send(
      provider.ws,
      ['request', id, ['objectStores', owner.database]]
    );
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

  /**
   * Prefix a given database name with its domain.
   *
   * @param {String} domain of database.
   * @param {String} name of database.
   * @return {String} prefixed db name.
   */
  prefixDb: function(domain, name) {
    return domain + DB_SEPERATOR + name;
  },

  /**
   * Extracts the database/domain from string.
   *
   *    var result = this.extractDb('http://foo.com@db');
   *    // => { domain: 'http://foo.com', database: 'db' }
   *
   * @param {String} input encoded db/domain.
   * @return {Object} { domain: domain, database: database }
   */
  extractDb: function(input) {
    var split = input.split(DB_SEPERATOR);
    return {
      domain: split[0],
      database: split[1]
    };
  },

  /**
   * Produce an aggregated list of all databases for all proxys.
   *
   *    // Example output:
   *
   *    {
   *      'providerDomain@databaseName': {
   *        name: 'providerDomain@databaseName',
   *        objectStores: [a, b, c]
   *      },
   *      ....
   *    }
   *
   * @return {Object} of databases.
   */
  _aggregateDatabases: function() {
    var result = [];

    Object.keys(this.providers).forEach(function(domain) {
      var provider = this.providers[domain];
      provider.databases.forEach(function(db) {
        result.push(this.prefixDb(domain, db));
      }, this);
    }, this);

    return result;
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
