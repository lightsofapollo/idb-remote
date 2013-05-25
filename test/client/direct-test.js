suite('direct', function() {
  var subject;
  var idb = window.indexedDB;
  var connection;

  setup(function() {
    subject = new IDBRemote.Client.Direct();
  });

  /* create / teardown database */

  var dbSetup = {
    name: 'idbremote-testing',
    version: 1,
    store: 'table',
    primaryKey: '_id',
    rows: [
      { _id: 1, name: 'foo' },
      { _id: 2, key: 'bar' },
      { _id: 3, name: 'baz', age: 16  }
    ]
  };

  suiteSetup(function(done) {
    var openReq = idb.open(dbSetup.name, dbSetup.version);
    openReq.onupgradeneeded = function(e) {
      var db = e.target.result;

      var objectStore = db.createObjectStore(
        dbSetup.store,
        { keyPath: dbSetup.primaryKey }
      );

      dbSetup.rows.forEach(function(row) {
        objectStore.put(row);
      });
    };

    openReq.onsuccess = function(e) {
      connection = e.target.result;
      done();
    };
  });

  suiteTeardown(function(done) {
    connection.close();
    idb.deleteDatabase(dbSetup.name).onsuccess = function() {
      done();
    };
  });

  suite('exposeDatabases / databases', function() {
    setup(function() {
      subject.exposeDatabases(['foo']);
    });

    test('initial set', function(done) {
      subject.databases(function(err, list) {
        assert.ok(!err, 'is successful');
        assert.deepEqual(list, ['foo']);
        done();
      });
    });

    test('after altering available dbs', function() {
      subject.exposeDatabases(dbSetup.name);

      subject.databases(function(err, list) {
        assert.ok(!err, 'is successful');
        assert.deepEqual(list, [dbSetup.name]);
      });
    });
  });

  suite('#objectStores', function() {
    test('success', function(done) {
      subject.objectStores(dbSetup.name, function(err, list) {
        if (err) {
          return done(err);
        }

        assert.deepEqual(list, [dbSetup.store]);
        done();
      });
    });
  });

  suite('#all', function() {
    suite('success', function() {
      var records = [];
      setup(function(done) {
        var emitter = subject.all(dbSetup.name, dbSetup.store);
        emitter.on('end', function() {
          done();
        });

        emitter.on('data', function(item) {
          records.push(item);
        });
      });

      test('list', function() {
        assert.deepEqual(
          dbSetup.rows,
          records
        );
      });
    });
  });

});
