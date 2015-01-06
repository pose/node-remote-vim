Control vim servers (or instances) programmatically. You can think this module as the Node.js equivalent of [vimrunner](https://github.com/AndrewRadev/vimrunner). (Warning: Only supported for OS X)

### Install

```sh
npm install remote-vim
```

### Usage

Import `ls` and `create` functions.

```js
var ls     = require('remote-vim').ls;
var create = require('remote-vim').create;
```

`ls`: List the running vim servers.

```js
ls(function (err, vims) {
  if (err) { throw err; }
  vims.forEach(function (vim) {
    console.log('vim instance named "' + vim.id + '" running at "' + vim.cwd + '"');
  });
});
```

`create`: Create a new vim server.

```js
create('myvim', function (err, vim) {
  if (err) { throw err; }
  
  // Gets first command from history
  vim.expr('histget("cmd", 1)', function (err, historyItem) {
    console.log('First command was: ' + historyItem); 
  });
});
```

vim instances have the following methods:

  * `open(path,[line,]cb)`: Open `path` at `line`. `cb: func (err) { }`.
  * `expr(path, cb)`: Evaluate expression. `cb: func (err, result) { }`.
  * `sendKeys(keys, cb)`: Send keys to vim instance. `cb: func (err) { }`.
  * `exit([force,]cb)`: Close instance using `:qa<CR>`. with `force: true` uses `:qa!<CR>`.
