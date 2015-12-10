var EventEmitter = require('events').EventEmitter;
var TabManager = require('../lib/TabManager')(EventEmitter);

//TODO: Rewrite this so that it is runnable using Mocha.

var manager = new TabManager();
manager.on('TabOpened', function(tab) { console.log('TabOpened:', tab.API.URL()); });
manager.on('TabSwitched', function(tab) { console.log('TabSwitched', tab.API.URL()); });

var tab1 = manager.runTab('/1');
var tab2 = manager.runTab('/2');
manager.runTab('/1');
tab2.API.focus();
tab2.API.focus();