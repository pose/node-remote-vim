var assert = require('assert');

var uuid = require('uuid');

var create = require('./index').create;
var ls     = require('./index').ls;
var async  = require('async');


var TEST_TIMEOUT_MS = 5000;

// Test timeout
var done = (function () {
  var timer = setTimeout(function () {
    assert.ok(false, 'Test timeout');
    process.exit(1);
  }, TEST_TIMEOUT_MS);

  return function () { clearTimeout(timer); };
})();

function getHistory(vim, size, cb) {
  var i, a = [];
  for (i = 0; i < size; i++) { a.push(i); }

  async.map(a, function(i, cb2) { vim.expr('histget("cmd", ' + i + ')', cb2); }, cb);
}

var generatedName = 'test-' + uuid();
create(generatedName, function (err, vim) {
  assert.ifError(err);
  assert.equal(generatedName, vim.id);
  ls(function (err, vims) {
    vims = vims.filter(function (vim) { return vim.id === generatedName.toUpperCase(); });
    assert.equal(1, vims.length);
    vims[0].open('example/index.html', function (err) {
      assert.ifError(err);

      var size = 25;

      getHistory(vim, size, function (err, res) {
        assert.ifError(err);
        assert.equal(size, res.length);
        vim.exit(function (err) {
          assert.ifError(err);
          done();
        });
      });

    });
  });
});
