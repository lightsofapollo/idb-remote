(function() {

  if (typeof module === 'undefined') {
    window.IDBRemote = {};
    return;
  }

  module.exports = {
    Client: require('./client')
  };

}());

