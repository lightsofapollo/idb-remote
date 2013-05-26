suite('node/proxy-bridge', function() {
  if (typeof window !== 'undefined')
    return test('node only test', function() {});

  var ws = require('ws');
  var port = 60123;
  var ProxyBridge = require('../../lib/node/proxy-bridge');

  /**
   * Wait for the websocket to receive one message.
   */
  function oneMessage(client, callback) {
    client.once('message', function(msg) {
      callback(JSON.parse(msg));
    });
  }

  var server;
  var client;
  var provider;
  var providerDomain = 'http://provider.localhost';

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
    var payload = [
      'register proxy',
      {
        domain: providerDomain,
        databases: ['db'],
        objectStores: ['store1', 'store2']
      }
    ];

    // as a standalone function so it can be both a test and setup.
    function register(done) {
      var pending = 3;
      function next() {
        if (--pending === 0)
          return done();
      }

      provider.send(JSON.stringify(payload));

      subject.on('register proxy', function() {
        var details = subject.providers[providerDomain];
        assert.ok(details, 'registers proxy');

        // make sure everything is copied over correctly
        assert.deepEqual(details.databases, payload[1].databases, 'databases');
        assert.deepEqual(details.objectStores, payload[1].objectStores, 'objectStores');

        next();
      });

      function gotRegister(client) {
        oneMessage(client, function(msg) {
          assert.deepEqual(msg, payload);
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

});
