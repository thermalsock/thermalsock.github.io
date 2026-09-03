(function(global) {
  "use strict";
  function Store(namespace) {
    this.ns = namespace;
  }
  Store.prototype._key = function(key) {
    return this.ns + "." + key;
  };
  Store.prototype.get = function(key, fallback) {
    try {
      var raw = localStorage.getItem(this._key(key));
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  };
  Store.prototype.set = function(key, value) {
    try {
      localStorage.setItem(this._key(key), JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  };
  Store.prototype.remove = function(key) {
    try {
      localStorage.removeItem(this._key(key));
      return true;
    } catch (e) {
      return false;
    }
  };
  Store.prototype.clear = function() {
    try {
      var prefix = this.ns + ".";
      var doomed = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(prefix) === 0) doomed.push(k);
      }
      doomed.forEach(function(k) {
        localStorage.removeItem(k);
      });
      return true;
    } catch (e) {
      return false;
    }
  };
  Store.prototype.debounced = function(key, waitMs) {
    var self = this;
    var timer = null;
    var pending;
    var wait = waitMs || 400;
    return function(value) {
      pending = value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function() {
        timer = null;
        self.set(key, pending);
      }, wait);
    };
  };
  function createStore(namespace) {
    return new Store(namespace);
  }
  global.TSStore = {
    create: createStore
  };
})(window);