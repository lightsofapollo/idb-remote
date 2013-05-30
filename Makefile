VENDOR_LIST=node_modules/socket.io-client/dist/socket.io.js \
	node_modules/eventemitter2/lib/eventemitter2.js

LIB_LIST=lib/index.js \
	lib/client.js \
  lib/proxy.js \
  lib/proxy/socketio.js \
  lib/client/direct.js \
  lib/client/socketio.js
						
.PHONY: test
test: test-node test-browser

.PHONY: test-node
test-node:
	./node_modules/mocha/bin/mocha --ui tdd \
		./test/setup.js \
		./test/node/*-test.js \
		./test/proxy/*-test.js \
		./test/client/socketio-test.js

.PHONY: test-browser
test-browser:
	./node_modules/test-agent/bin/js-test-agent test 

.PHONY: test-server
test-server:
	./node_modules/test-agent/bin/js-test-agent server --growl

.PHONY: dist
dist:
	rm -f dist/idb-remote.js
	cat $(VENDOR_LIST) $(LIB_LIST) >> dist/idb-remote.js
