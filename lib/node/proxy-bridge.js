var EventEmitter = require('events').EventEmitter;

// used to split the domain from database name.
var DB_SEPERATOR = '@';
var uuid = require('uuid');

Bridge.DB_SEPERATOR = DB_SEPERATOR;

function Bridge(io) {
  EventEmitter.call(this);

  this.io = io;

  // handle provider connections
  this._providers = this.io.of('/providers');
  this._providers.on('connection', this._onProvider.bind(this));

  // handle client connections
  this._clients = this.io.of('/clients');
  this._clients.on('connection', this._onClient.bind(this));

  /**
   * Table of all content providers.
   * One provider per domain.
   */
  this.providers = {};

  /**
   * All ongoing "streams"
   * format is: { id: providerDomain }
   */
  this.streams = {};
}

Bridge.prototype = {
  __proto__: EventEmitter.prototype,

  _onProvider: function(con) {
    con.on(
      'register proxy',
      this.registerProxy.bind(this, con)
    );

    con.on(
      'stream',
      this.proxyStream.bind(this, con)
    );
  },

  _onClient: function(con) {
    con.on(
      'databases',
      this.requestDatabases.bind(this, con)
    );

    con.on(
      'objectStores',
      this.requestObjectStores.bind(this, con)
    );

    con.on(
      'all',
      this.requestAll.bind(this, con)
    );
  },

  registerProxy: function(client, provider) {
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
    this.providers[provider.domain] = provider;

    // cleanup registered providers once they disconnect
    client.once('disconnect', this._unregisterProxy.bind(this, provider.domain));
    this.emit('register proxy', provider);

    this._clients.emit('register proxy', provider);
    provider.client = client;
  },

  _unregisterProxy: function(domain) {
    var provider = this.providers[domain];

    delete this.providers[domain];
    this.emit('unregister proxy', domain);
    // notify all of the clients
    this._clients.emit('unregister proxy', domain);
  },

  requestDatabases: function(client, callback) {
    if (!callback)
      return client.emit('error', 'database request without callback');

    callback(this._aggregateDatabases());
  },

  requestObjectStores: function(client, db, callback) {
    if (!callback)
      return client.emit('error', 'callback must be provided to objectStore request');

    // find the provider
    var owner = this.getOwner(client, db);
    if (!owner)
      return;

    // find provider by domain
    var provider = this.getProvider(client, owner);
    if (!provider)
      return;

    provider.client.emit('objectStores', owner.database, function(objectStores) {
      callback(objectStores);
    });
  },

  requestAll: function(client, db, store, options) {
    // create request
    var id = this.createStream(client);

    var owner = this.getOwner(client, db);
    if (!owner)
      return;

    var provider = this.getProvider(client, owner);
    if (!provider)
      return;

    provider.client.emit(
      'all',
      id,
      owner.database,
      store,
      options
    );
  },

  /**
   * Fetches provider information from owner reference. See getOwner.
   *
   * @param {Object} client socket.io client.
   * @param {Object|String} ownerOrDomain from getOwner or domain.
   * @return {Object} provider reference. (from this.providers).
   */
  getProvider: function(client, ownerOrDomain) {
    var domain = typeof ownerOrDomain === 'object' ?
                   ownerOrDomain.domain :
                   ownerOrDomain;

    // find provider by domain
    var provider = this.providers[domain];
    if (!provider) {
      return client.emit(
        'error', 'no provider for domain: ' + domain
      );
    }

    return provider;
  },

  /**
   * Attempts to find database / domain pair when given an encoded db name.
   *
   * @param {Object} client socket.io socket.
   * @param {String} db encoded db string (see encodeDb)
   * @return {Null|Object} { database: db, domain: domain }
   */
  getOwner: function(client, db) {
    var owner = this.extractDb(db);
    if (!owner || !owner.database || !owner.domain) {
      client.emit('error', 'invalid database: ' + db);
      return null;
    }

    return owner;
  },

  /**
   * Prefix a given database name with its domain.
   *
   * @param {String} domain of database.
   * @param {String} name of database.
   * @return {String} prefixed db name.
   */
  encodeDb: function(domain, name) {
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
        result.push(this.encodeDb(domain, db));
      }, this);
    }, this);

    return result;
  },

  createStream: function(client) {
    var id = uuid.v4();
    this.streams[id] = client;

    client.once('disconnect', function disconnect() {
      // when the client disconnects remove references to it.
      delete this.streams[id];
    }.bind(this));

    return id;
  },

  proxyStream: function(sender, id, content) {
    var client = this.streams[id];

    // cant do anything without a client...
    if (!client) {
      return sender.emit(
        'error', 'attempted to send stream data to missing id :' + id
      );
    }

    // proxy content to client
    client.emit('stream', id, content);

    // check the event type if its end remove the stream reference.
    if (content[0] === 'end') {
      delete this.streams[id];
    }
  }
};

module.exports = Bridge;
