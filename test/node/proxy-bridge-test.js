suite('node/proxy-bridge', function() {
  if (typeof window !== 'undefined')
    return test('node only test', function() {});

  var ws = require('ws');
  var port = 60123;
  var ProxyBridge = require('../../lib/node/proxy-bridge');
  var dbName = 'db';

  var _id = 0;

  /**
   * Send a command that requires a response.
   */
  function command(client, msg, callback) {
    var requestId = ++_id;
    var cmd = JSON.stringify([
      'request', requestId, msg
    ]);

    oneMessage(client, 'response ' + requestId, callback);
    client.send(cmd);
  }

  /**
   * Wait for the websocket to receive one message.
   */
  function oneMessage(client, type, callback) {
    if (typeof type === 'function') {
      callback = type;
      type = null;
    }

    client.on('message', function handle(msg) {
      var data = JSON.parse(msg);

      if (type && data[0] !== type)
        // type filter is present and does not match skip
        return;

      // do it in the next tick so it can't throw before removing listener
      process.nextTick(callback.bind(null, data));
      client.removeListener('message', handle);
    });
  }

  function registerProxy() {
    setup(function(done) {
      // bind so it does not fail
      subject.once('register proxy', done.bind(null, null));
      provider.send(JSON.stringify(registerPayload));
    });
  }

  var server;
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
  setup(function(done) {
    server = new ws.Server({ port: port }, function() {
     subject = new ProxyBridge(server);
     done();
    });
  });

  // setup client ( who wishes information from the provider )
  setup(function(done) {
    client = new ws('ws://localhost:' + port, {
      origin: 'http://client.localhost'
    });

    // wait for open so sockets can close cleanly
    client.on('open', done);
  });

  // and the provider (which will respond to client requests )
  setup(function(done) {
    provider = new ws('ws://localhost:' + port, {
      origin: 'http://provider.localhost'
    });

    provider.on('open', done);
  });

  teardown(function() {
    // immediately close client (to prevent network errors)
    client.terminate();
    provider.terminate();

    // close server
    server.close();
  });

  test('initilization', function() {
    assert.equal(subject.server, server);
  });

  suite('provider: [un]register proxy', function() {
    // as a standalone function so it can be both a test and setup.
    function register(done) {
      var pending = 3;
      function next() {
        if (--pending === 0)
          return done();
      }

      provider.send(JSON.stringify(registerPayload));

      subject.on('register proxy', function() {
        var details = subject.providers[providerDomain];
        assert.ok(details, 'registers proxy');

        // make sure everything is copied over correctly
        assert.deepEqual(details.databases, registerPayload[1].databases, 'databases');
        next();
      });

      function gotRegister(client) {
        oneMessage(client, function(msg) {
          assert.deepEqual(msg, registerPayload);
          next();
        });
      }

      // broadcast (even to provider)
      [client, provider].forEach(gotRegister);
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

        oneMessage(client, function(msg) {
          assert.equal(msg[0], 'unregister proxy');
          assert.equal(msg[1], providerDomain);

          next();
        });

        provider.terminate();
      });
    });
  });

  suite('client request: databases', function() {
    registerProxy();

    var response;
    setup(function(done) {
      command(client, ['databases'], function(_response) {
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
        response[1]
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

  suite('cient reques: objectStores', function() {
    registerProxy();

    var response;
    var stores = ['a', 'b', 'c'];

    setup(function(done) {
      var db = subject.prefixDb(providerDomain, 'db');
      var isDone = false;

      // verify provider gets request
      oneMessage(provider, 'request', function(msg) {
        // expect msg format: [type, id, content];
        var content = msg[2];
        assert.equal(content[0], 'objectStores');
        assert.equal(content[1], dbName, 'sends db name');

        // send response to server
        provider.send(JSON.stringify(
          ['response ' + _id, ['objectStores', stores]]
        ));

        // mark request as sent
        isDone = true;
      });

      command(client, ['objectStores', db], function(_response) {
        response = _response;
        assert.ok(isDone);
        done();
      });
    });

    test('proxies response to client', function() {
      assert.deepEqual(
        response[1],
        ['objectStores', stores]
      );
    });
  });
});
