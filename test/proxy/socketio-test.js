suite('proxy/socketio', function() {
  var Emitter;
  var Proxy;

  if (typeof window === 'undefined') {
    Emitter = require('eventemitter2').EventEmitter2;
    Proxy = require('../../lib/proxy/socketio').Socketio;
  } else {
    Emitter = window.EventEmitter2;
    Proxy = window.IDBRemote.Proxy.Socketio;
  }

  var toServer = [];
  var emit;
  var onEmit;
  var domain = 'http://foobar.com';
  var allEvents = [];

  var registerPayload = {
    domain: domain,
    databases: ['a', 'b', 'c']
  };

  function register() {
    setup(function(done) {
      subject.register(domain, done);
      onEmit = function(type, payload, callback) {
        onEmit = null;
        callback();
      };
    });
  }

  var mockClient = {};
  suiteSetup(function() {
    mockClient.objectStores = function(dbName, cb) {
      return setTimeout(cb, 0, null, [dbName]);
    };

    mockClient.databases = function(cb) {
      setTimeout(cb, 0, null, registerPayload.databases);
    };

    mockClient.all = function(db, store, options) {
      var emitter = new Emitter();
      setTimeout(function() {
        allEvents.forEach(function(event) {
          emitter.emit.apply(emitter, event);
        });
      });

      return emitter;
    };
  });

  var socket;
  var subject;
  setup(function() {
    onEmit = null;
    toServer.length = 0;
    allEvents.length = 0;
    socket = new Emitter();
    emit = socket.emit.bind(socket);

    socket.emit = function(type) {
      if (type === 'newListener')
        return;

      var args = Array.prototype.slice.call(arguments);
      onEmit && onEmit.apply(this, args);
      toServer.push(args);
    };

    subject = new Proxy(mockClient, socket);
  });

  test('initialization', function() {
    assert.equal(subject.client, mockClient);
    assert.equal(subject.socket, socket);
  });

  suite('#register', function() {
    test('success', function(done) {
      var isDone = false;

      onEmit = function(type, content, callback) {
        assert.equal(type, 'register proxy');
        assert.deepEqual(content, registerPayload, 'payload');
        isDone = true;

        callback();
      };

      subject.register(domain, function() {
        assert.ok(isDone);
        done();
      });
    });
  });

  suite('proxy: objectStore', function() {
    register();

    test('success', function(done) {
      emit('objectStores', 'a', function(list) {
        assert.deepEqual(list, ['a']);
        done();
      });
    });
  });

  suite('proxy: all', function() {
    register();

    var messages = [];
    var id = 'woot';

    setup(function(done) {
      messages.length = 0;
      allEvents = [
        ['error', 'error'],
        ['data', 'data'],
        ['end']
      ];

      onEmit = function(type, id, content) {
        messages.push([type, id, content]);
        if (content[0] === 'end')
          done();
      };

      emit('all', id, 'db', 'store', {});
    });

    test('server gets events', function() {
      var expected = [];
      allEvents.forEach(function(content) {
        expected.push(['stream', id, content]);
      });

      assert.deepEqual(messages, expected);
    });
  });

});
