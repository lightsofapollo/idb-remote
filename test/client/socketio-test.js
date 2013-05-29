suite('client/socketio', function() {
  var Emitter;
  var Client;

  if (typeof window === 'undefined') {
    Emitter = require('eventemitter2').EventEmitter2;
    Client = require('../../lib/client/socketio').Socketio;
  } else {
    Emitter = window.EventEmitter2;
    Client = window.IDBRemote.Client.Socketio;
  }

  var toServer = [];
  var emit;

  var socket;
  var subject;
  setup(function() {
    toServer.length = 0;
    socket = new Emitter();
    emit = socket.emit.bind(socket);

    socket.emit = function(type) {
      if (type === 'newListener')
        return;

      toServer.push(Array.prototype.slice.call(arguments));
    };

    subject = new Client(socket);
  });

  test('initialization', function() {
    assert.equal(subject.socket, socket);
  });

  suite('#databases', function() {
    var dbs = ['db'];
    test('success', function(done) {
      subject.databases(function(err, list) {
        assert.deepEqual(list, dbs);
        done();
      });

      assert.equal(toServer[0][0], 'databases');
      assert.ok(typeof toServer[0][1] === 'function', 'sends callback');

      toServer[0][1](null, dbs);
    });
  });


  suite('#objectStores', function() {
    var stores = ['a'];
    var db = 'dbName';

    test('success', function(done) {
      subject.objectStores(db, function(err, list) {
        assert.deepEqual(list, stores);
        done();
      });

      assert.equal(toServer[0][0], 'objectStores');
      assert.equal(toServer[0][1], db);
      assert.ok(typeof toServer[0][2] === 'function', 'sends callback');

      toServer[0][2](null, stores);
    });
  });

  suite('#all', function() {
    var stream;
    var db = 'db';
    var store = 'store';
    var id = 'wow-id';
    var calledWith;

    setup(function() {
      stream = subject.all(db, store);

      // save the request parameters
      assert.ok(toServer[0][0], 'all');
      calledWith = toServer[0].slice(1, 4);

      // send an id to client
      var callback = toServer[0].pop();
      callback(id);
    });

    test('returns ee2', function() {
      assert.instanceOf(stream, Emitter);
    });

    test('registers stream', function() {
      var id = Object.keys(subject.streams)[0];
      assert.equal(subject.streams[id], stream);
    });

    test('on disconnect', function(done) {
      stream.once('error', function(err) {
        assert.instanceOf(err, Error);
        assert.include(err.message, 'closed');
        done();
      });

      emit('disconnect');
    });

    test('events: data', function() {
      var gotEvents = [];

      stream.on('data', function(value) {
        gotEvents.push(['data', value]);
      });

      var events = [
        ['data', 1],
        ['data', 2]
      ];

      events.forEach(function(event) {
        emit('stream', id, event);
      });

      assert.deepEqual(gotEvents, events);
    });

    function closesStream(event, done) {
      stream.on(event, function() {
        // next tick of the event loop
        setTimeout(function() {
          assert.ok(!subject.streams[id], 'removes stream');
          done();
        });
      });
      emit('stream', id, [event]);
    }

    test('events: end', closesStream.bind(null, 'end'));
    test('events: error', closesStream.bind(null, 'error'));
  });
});
