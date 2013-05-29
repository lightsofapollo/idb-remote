/** this file is intended as documentation */

/**
 *
 * @name Client
 * @constructor
 * @param {Object} [options] reserved for client specific config.
 */
function Client() {
}

Client.prototype = {

  /**
   * Async call to find all databases:
   *
   *    client.databases(function(err, list) {
   *      //
   *    });
   *
   * @param {Function} callback [Error|Null err, Array list].
   */
  databases: function(callback) {
  },

  /**
   * Find the names of all object stores for a given database.
   *
   *    subject.objectStores(dbName, function(err, list) {
   *    });
   *
   * @param {String} database to find stores for.
   * @param {Function} callback [Error|Null err, Array list].
   */
  objectStores: function(database, callback) {
  },

  /**
   * Find all records for a given database + objectStore.
   *
   *    var req = client.all(db, store);
   *
   *    req.on('data', function(record) {
   *
   *    });
   *
   *    req.on('error', function(err) {
   *    });
   *
   *    req.on('end', function() {
   *
   *    });
   *
   * @param {String} database to find records in.
   * @param {String} objectStore to find records in.
   * @param {Object} [options] optional options 
   *  (reserved for future use).
   *
   * @return {EventEmitter2} returns an event emitter 2 interface
   */
  all: function() {
  }

};
