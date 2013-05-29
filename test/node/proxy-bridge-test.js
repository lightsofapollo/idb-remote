suite('node/proxy-bridge', function() {
  if (typeof window !== 'undefined')
    return test('node only test', function() {});

  var socketio = require('socket.io');
  var ioClient = require('socket.io-client');
  var port = 60123;
  var ProxyBridge = require('../../lib/node/proxy-bridge');
  var dbName = 'db';

  function registerProxy() {
    setup(function(done) {
      var pending = 2;
      function next() {
        if (--pending === 0)
          done();
      }
      // bind so it does not fail
      subject.once('register proxy', next);
      client.once('register proxy', next);

      provider.emit.apply(provider, registerPayload);
    });
  }

  var client;
  var provider;

  var providerDomain = 'http://provider.localhost';
  var registerPayload = [
    'register proxy',
    {
      domain: providerDomain,
      databases: [dbName]
    }
  ];

  var subject;
  var io;
  var clientOptions = {
    transports: ['websocket'],
    'force new connection': true
  };

  setup(function(done) {
    io = socketio.listen(port);
    subject = new ProxyBridge(io);

    client =
      ioClient.connect('ws://localhost:' + port + '/clients', clientOptions);

    provider =
      ioClient.connect('ws://localhost:' + port + '/providers', clientOptions);

    client.on('connect', next);
    provider.on('connect', next);

    var pending = 2;
    function next() {
      if (--pending === 0) {
        done();
      }
    }
  });

  teardown(function() {
    client.socket.disconnect();
    provider.socket.disconnect();

    io.server.close();
  });

  test('initilization', function() {
    assert.equal(subject.io, io);
  });

  suite('provider: [un]register proxy', function() {
    // as a standalone function so it can be both a test and setup.
    function register(done) {
      var pending = 2;
      function next() {
        if (--pending === 0)
          return done();
      }

      subject.on('register proxy', function() {
        var details = subject.providers[providerDomain];
        assert.ok(details, 'registers proxy');

        // make sure everything is copied over correctly
        assert.deepEqual(details.databases, registerPayload[1].databases, 'databases');
        next();
      });

      client.on('register proxy', function(msg) {
        assert.deepEqual(msg, registerPayload[1]);
        next();
      });

      provider.emit.apply(provider, registerPayload);
    }

    test('registers provider', register);

    suite('unregister proxy', function() {
      setup(register);

      test('broadcast', function(done) {
        var pending = 2;
        function next() {
          if (--pending === 0)
            return done();
        }

        // wait for the server to dispatch its own message
        subject.once('unregister proxy', function(domain) {
          assert.equal(domain, providerDomain, 'sends domain');
          assert.ok(!subject.providers[providerDomain]);
          next();
        });

        client.once('unregister proxy', function(domain) {
          assert.equal(domain, providerDomain);
          next();
        });

        provider.socket.disconnect();
      });
    });
  });

  suite('client request: databases', function() {
    registerProxy();

    var response;
    setup(function(done) {
      client.emit('databases', function(_response) {
        response = _response;
        done();
      });
    });

    test('result', function() {
      var dbName =
        registerPayload[1].databases;

      var prefixed = subject.prefixDb(providerDomain, dbName);
      var expected = [prefixed];

      assert.deepEqual(
        expected,
        response
      );
    });
  });

  suite('#extractDb', function() {
    var domain = 'http://calendar.gaiamobile.org';
    var input = domain + ProxyBridge.DB_SEPERATOR + dbName;

    test('decode', function() {
      assert.deepEqual(
        subject.extractDb(input),
        { domain: domain, database: dbName }
      );
    });
  });

  suite('client requests: objectStores', function() {
    registerProxy();

    var response;
    var stores = ['a', 'b', 'c'];

    setup(function(done) {
      var db = subject.prefixDb(providerDomain, 'db');
      var isDone = false;

      // verify provider gets request
      provider.on('objectStores', function(db, callback) {
        if (typeof callback !== 'function')
          return done(new Error('callback must be provided'));

        assert.equal(db, dbName, 'sends db name');
        callback(stores);
        isDone = true;
      });

      client.emit('objectStores', db, function(_response) {
        response = _response;
        assert.ok(isDone);
        done();
      });
    });

    test('proxies response to client', function() {
      assert.deepEqual(
        response,
        stores
      );
    });
  });

  suite('#createStream', function() {
    registerProxy();

    var result;
    setup(function() {
      result = subject.createStream(client);
    });

    test('first stream', function() {
      assert.equal(subject.streams[result], client);
    });

    test('client disconnects', function(done) {
      // servers reference to the client
      var serverSocket =
        io.sockets.sockets[client.socket.sessionid];

      client.on('disconnect', function() {
        assert.ok(!subject.streams[result]);
        done();
      });

      serverSocket.disconnect();
    });
  });

  suite('#proxyStream', function() {
    registerProxy();

    var id;

    var serverSocket;
    setup(function() {
      // must get server socket from specific room for this to work.
      serverSocket =
        io.of('/clients').sockets[client.socket.sessionid];

      id = subject.createStream(serverSocket);
    });

    suite('multiple messages', function() {
      var messages;

      setup(function(done) {
        messages = [];
        var pending = 2;
        function next() {

          if (--pending === 0)
            done();
        }

        client.on('stream', function(id, content) {
          messages.push([id, content]);
          next();
        });

        provider.emit('stream', id, ['data', 1]);
        provider.emit('stream', id, ['data', 2]);
      });

      test('stream messages', function() {
        var expected = [
          [id, ['data', 1]],
          [id, ['data', 2]]
        ];

        assert.deepEqual(
          messages,
          expected
        );
      });
    });

    test('on stream end', function(done) {
      provider.emit('stream', id, ['end']);

      client.on('stream', function() {
        assert.ok(!subject.streams[id]);
        done();
      });
    });

  });


});
