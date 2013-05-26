(function() {

  var isNode = typeof window === 'undefined';
  var ctx = isNode ? global : window;

  function setupChai(chai) {
    chai.Assertion.includeStack = true;
    ctx.assert = chai.assert;
  }

  // node setup
  if (isNode) {
    setupChai(require('chai'));
  } else {
    require('/node_modules/eventemitter2/lib/eventemitter2.js');

    // browser setup
    require('/lib/index.js');
    require('/lib/client.js');
    require('/lib/client/direct.js');
    require('/node_modules/chai/chai.js', function() {
      setupChai(window.chai);
    });
  }


}(

));
