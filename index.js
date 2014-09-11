var async = require('async');
var spawn = require('child_process').spawn;

var vimPath = '/usr/local/bin/mvim';

/**
 * Create a new Vim instance
 *
 * @constructor
 * @private
 */
function Vim(id, cwd) {
  this.id = id;
  this.cwd = cwd;
}

/**
 * Open a file.
 *
 * @method
 * @public
 *
 * @param {String}    [path]    path to file
 * @param {Number}    [line=0]  line to go on the file to open
 * @param {Function}  [cb]      callback : function (err) {}
 */
Vim.prototype.open = function (path, line, cb) {
  if (cb === undefined) {
    cb = line;
    line = 0;
  }
  var ref = spawn(vimPath, ['--servername', this.id, '--remote-tab', '+' + line, path]); 

  ref.on('error', function (err) {
    cb(err);
  });

  ref.on('exit', function () {
    cb();
  });
};

/**
 *
 * Execute expression on Vim.
 *
 * @method
 * @public
 *
 * @param {String}   [expr]  expression to execute.
 * @param {Function} [cb]    callback : function (err, returnValue) { }
 *
 * @example
 *
 *    vim.expr('getcwd()', function (err, cwd) {
 *      if (err) { return; }
 *      console.log('Vim current path: ' + cwd);
 *    });
 *
 */
Vim.prototype.expr = function (expr, cb) {
  var ref = spawn(vimPath, ['--servername', this.id, '--remote-expr', expr]);

  var content = '';

  ref.stdout.on('data', function (data) {
    content += data.toString();
  });

  ref.stdout.on('end', function () {
    var value = content.split('\n')[0];
    cb (null, value);
  });

  ref.on('error', function (err) {
    cb(err);
  });
};

/**
 *
 * Send keys to Vim.
 *
 * @method
 * @public
 *
 * @param {String}   [keys]  keys to type.
 * @param {Function} [cb]    callback : function (err) { }
 *
 * @example
 *
 *    vim.expr(':wq<CR>', function (err) {
 *      if (err) { return; }
 *      console.log('Keys executed!');
 *    });
 *
 */
Vim.prototype.sendKeys = function (keys, cb) {
  var ref = spawn(vimPath, ['--servername', this.id, '--remote-send', keys]);

  ref.on('error', function (err) {
    cb(err);
  });

  ref.on('exit', function () {
    cb();
  });
};

/**
 *
 * Close all buffers and exit Vim.
 *
 * @method
 * @public
 *
 * @param {Boolean}  [force=false]  force exit (using !).
 * @param {Function} [cb]           callback : function (err) { }
 *
 */
Vim.prototype.exit = function (force, cb) {
  if (cb === undefined) {
    cb = force;
    force = false;
  }
  var cmd = force ? ':qa!<CR>' : ':qa<CR>';
  this.sendKeys(cmd, cb);
};

function enrichVimData(vimServerHandler, cb) {
  var vim = new Vim(vimServerHandler);
  vim.expr('getcwd()', function (err, cwd) {
    if (err) { return cb(err); }
    vim.cwd = cwd;
    return cb(null, vim);
  });
}

/**
 *
 * Launch a Vim instance.
 *
 * @static
 * @public
 *
 * @param {String}   [servername]   Name of the new Vim.
 * @param {String}   [path='']      Path to first file to open.
 * @param {Function} [cb]           callback : function (err, vim) { }
 *
 */
exports.create = function create(servername, path, cb) {
  if (cb === undefined) {
    cb = path;
    path = '';
  }
  var ref = spawn(vimPath, ['--servername', servername, '--startuptime', '/dev/stdout', path || ''], {detached: true, stdio: ['ignore', 'pipe', 'ignore']}); 


  function dataHandler(data) {
    data = data.toString();
    if (/--- VIM STARTED ---/.test(data)) {
      ref.stdout.removeListener('data', dataHandler);
      ref.stdout.unref();
      if (!path) {
        enrichVimData(servername, function (err, vim) {
          if (err) { return cb(err); }
          cb(null, vim);
        });
        return;
      }
      return cb(null, new Vim(servername, path));
    }
  }

  ref.stdout.on('data', dataHandler);

  ref.on('error', function (err) {
    ref.stdout.removeListener('data', dataHandler);
    ref.stdout.unref();
    cb(err);
  });

};

/**
 *
 * List Vim instances currently running.
 *
 * @static
 * @public
 *
 * @param {Function} [cb]   callback : function (err, arrayOfVims) { }
 *
 */
exports.ls = function ls(cb) {
  var vimInstances = [];

  var content = '';

  var ref = spawn(vimPath, ['--serverlist']);
  ref.stdout.on('data', function (data) {
    content += data.toString();
  });
  ref.stdout.on('end', function () {
    vimInstances = content.split('\n');
    vimInstances = vimInstances.filter(function (e) { return !!e; });
    vimInstances = async.map(vimInstances, enrichVimData, cb);
  });
  ref.on('error', function (err) {
    cb(err);
  });
};
