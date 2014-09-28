var fs = require('fs');
var spawn = require('child_process').spawn;

var temp = require('temp');
var async = require('async');

var vimPath = '/usr/local/bin/mvim';

temp.track();

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
 * @param {Function} [cb]    callback : function (err, returnValue) { }
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
 * @param {Function} [cb]    callback : function (err) { }
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
 * @param {Function} [cb]           callback : function (err) { }
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

function createAndTouchTempFile(cb) {
  // Create a startup log file to search for "--- VIM STARTED ---"
  // string which indicates vim started.
  temp.open('node-remote-vim', function (err, info) {
    if (err) { return cb(err); }
    fs.write(info.fd, '');
    fs.close(info.fd, function(err) {
      if (err) { return cb(err); }
      cb(null, info.path);
    });
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
 * @param {Function} [cb]           callback : function (err, vim) { }
 *
 */
// TODO cwd directory != path directory. Create a way of setting
// cwd. Remove path as argument and replace it by cwd (where spawn
// executes the command).
exports.create = function create(servername, path, cb) {
  if (cb === undefined) {
    cb = path;
    path = '';
  }

  createAndTouchTempFile(function (err, startupLogPath) {
    if (err) { return cb(err); }

    var watcher;
    function watch () {
      fs.readFile(startupLogPath, function (err, data) {
        // TODO Improve me
        data = data.toString();

        if (/--- VIM STARTED ---/.test(data)) {
          watcher.close();
          if (!path) {
            return enrichVimData(servername, function (err, vim) {
              if (err) { return cb(err); }
              cb(null, vim);
            });
          }
          return cb(null, new Vim(servername, path));
        }
      });
    }

    var ref = spawn(vimPath, ['--servername', servername, '--startuptime', startupLogPath, path || ''], {detached: true, stdio: 'ignore'});

    watcher = fs.watch(startupLogPath, watch);

    ref.on('error', function (err) {
      watcher.close();
      cb(err);
    });
  });
};

/**
 *
 * List Vim instances currently running.
 *
 * @static
 * @public
 *
 * @param {Function} [cb]   callback : function (err, arrayOfVims) { }
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
