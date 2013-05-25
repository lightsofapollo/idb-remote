(function(exports, global) {
  var idb = window.indexedDB;

  function dbCommand(db, callback) {
    // database connection
    var connection;

    // intended to be invoked by caller's callback function.
    // will close the db connection...
    function done() {
      connection.close();
    }

    var req = idb.open(db);

    req.onsuccess = function(e) {
      connection = e.target.result;
      callback(null, connection, done);
    };

    req.onerror = function(e) {
      callback(e.target.error.name);
    };
  }

  function Direct() {
    this._databases = [];
  }

  Direct.prototype = {

    /**
     * Sets the available databases for this client.
     * This overrides any past calls.
     *
     * @param {String|Array} databases available.
     */
    exposeDatabases: function(databases) {
      this._databases.length = 0;

      if (typeof databases === 'string') {
        this._databases.push(databases);
        return;
      }

      databases.forEach(function(item) {
        this._databases.push(item);
      }, this);
    },

    /**
     * Fetches available databases... async for remote-ing reasons.
     *
     * @param {Function} callback [err, list].
     */
    databases: function(callback) {
      setTimeout(function(self) {
        callback(null, self._databases);
      }, 0, this);
    },

    /**
     * Opens database and reads all object store names.
     *
     * @param {String} db database to connect to.
     * @param {Function} callback [err, list].
     */
    objectStores: function(db, callback) {
      dbCommand(db, function(err, con, done) {
        // close command
        done();

        if (err)
          return callback(err);

        callback(
          null,
          // we need to convert the StringList to an Array
          Array.prototype.slice.call(con.objectStoreNames)
        );
      });
    },

    /**
     * Iterates through all records in database.
     *
     *    // can be found via .databases
     *    var db = 'mydb';
     *
     *    // can be found via .store
     *    var store = 'store';
     *
     *    var emitter = client.all(db, store);
     *
     *    emitter.on('error', function() {
     *      // ..
     *    });
     *
     *    emitter.on('data', function(record) {
     *      // record
     *    });
     *
     *    emitter.on('end', function() {
     *      // ..
     *    });
     *
     *
     * @param {String} db name of database.
     * @param {String} store name of store.
     * @param {Options} [options] extra configuration.
     * @return {EventEmitter2} event emitter that will emit events.
     */
    all: function(db, store, options) {
      var ee = new EventEmitter2();

      dbCommand(db, function(err, connection, done) {
        if (err) {
          done();
          return ee.emit('error', err);
        }

        var trans = connection.transaction(store);
        if (!connection.objectStoreNames.contains(store)) {
          return ee.emit(
            'error',
            new Error(
              'database "' + db + '" does not contian store "' + store + '"'
            )
          );
        }

        var objectStore = trans.objectStore(store);
        var req = objectStore.openCursor();

        // some problem opening cursor
        req.onerror = function() {
          done();
          return ee.emit('error', req.error.name);
        };

        // cursor has opened iterate until we don't have results...
        req.onsuccess = function(e) {
          var cursor = req.result;
          if (!cursor) {
            done();
            return ee.emit('end');
          }

          // emit cursor value
          ee.emit('data', cursor.value);

          // move to next item
          cursor.continue();
        };
      });

      return ee;
    }
  };

  exports.Direct = Direct;

}(
  // this will always run in web content
  window.IDBRemote.Client,
  window
));
