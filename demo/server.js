var ProxyBridge = require('../lib/node/proxy-bridge.js');
var io = require('socket.io').listen(60013);
subject = new ProxyBridge(io);
