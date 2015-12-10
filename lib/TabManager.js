if (typeof define !== 'function') { var define = require('amdefine')(module); }

define([], function() {
	function Index() {
		this._index = Object.create(null);
	}
	Index.prototype.add = function add(key, valueToAdd) {
		if (!this._index[key]) {
			this._index[key] = [];
		}
		this._index[key].push(valueToAdd);
	};
	Index.prototype.remove = function remove(key, valueToRemove) {
		if (!this._index[key]) {
			return;
		}
		this._index[key] = this._index[key].filter(function(storedValue) {
			return storedValue !== valueToRemove;
		});
		if (this._index[key].length === 0) {
			delete this._index[key];
		}
	};
	Index.prototype.get = function get(key) {
		// We could always return an array, but we choose not to, to lessen the GC strain in case of no index hits.
		return this._index[key];
	};
	
	return function(EventEmitter) {
		function TabAPI(manager, tab, URL, key) {
			var focused = false;
			this.URL = function getOrChangeURL(newURL) {
				if (typeof(newURL) === 'undefined') {
					return URL;
				}
				if (URL !== newURL) {
					manager.changeTabURL(tab, URL, newURL);
					URL = newURL;
					this.emit('URLChanged', URL);
				}
			};
			this.focus = function focus() {
				if (!focused) {
					focused = true;
					manager.switchToTab(tab);
					this.emit('TabFocused');
				}
			};
			this.blur = function blur() {
				if (focused) {
					focused = false;
					this.emit('TabBlurred');
				}
			};
		}
		TabAPI.prototype = Object.create(EventEmitter.prototype);
		
		function Tab(manager, URL, key) {
			this.API = new TabAPI(manager, this, URL, key);
		}

		function TabManager(options) {
			this._tabs = [];
			this._options = options || {};
			// The key derivation function is responsible for generating a unique key to identify tabs.
			this._keyDerivationFunction = this._options.keyDerivationFunction || function useEntireURL(URL) {
				return URL;
			};
			
			this._tabsByKey = new Index();
			this._activeTab = null;
		}

		TabManager.prototype = Object.create(EventEmitter.prototype);
		
		TabManager.prototype.switchToTab = function switchToTab(tab) {
			// We handle two forms of argument passing. One is to pass the URL of a tab.
			if (typeof(tab) === 'string') {
				// A string (presumably an URL) was passed, so we need to find the tab based on the URL.
				var derivedKey = this._keyDerivationFunction(tab);
				// Replace the argument with the actual tab, looked up in the index.
				var matchingTabs = this._tabsByKey.get(derivedKey);
				if (matchingTabs) {
					tab = matchingTabs[matchingTabs.length - 1];
				}
				else {
					tab = null;
				}
			}
			// If the active tab does not need switching, exit early.
			if (this._activeTab === tab) {
				return;
			}
			// Sanity check: does the tab (still) exist within our internal list?
			if (this._tabs.indexOf(tab) >= 0) {
				var oldActiveTab = this._activeTab;
				// It does. Mark it as active.
				this._activeTab = tab;
				// Blur (defocus) the previously-active tab, if any.
				if (oldActiveTab) {
					oldActiveTab.API.blur();
				}
				// Tell the new active tab that it has just been focused.
				tab.API.focus();
				// Notify subscribers.
				this.emit('TabSwitched', tab);
				return tab;
			}
			else {
				this.emit('error', new Error('Tab did not exist in the tab list when trying to switch'));
			}
		};
		
		TabManager.prototype.openTab = function openTab(URL) {
			// Derive the key used for finding tabs suitable for running.
			var derivedKey = this._keyDerivationFunction(URL);
			// Create the tab object with the derived key and the original URL that was passed.
			var newTab = new Tab(this, URL, derivedKey);
			// Insert the new tab into our internal array of tabs.
			this._tabs.push(newTab);
			// Also index the tab by its key.
			this._tabsByKey.add(derivedKey, newTab);
			// Inform listeners that a new tab has just been opened. Pass a reference to the tab object to the listeners.
			this.emit('TabOpened', newTab);
			return newTab;
		};
		
		TabManager.prototype.runTab = function runTab(URL) {
			// Obtain the unique key to identify the tab to be opened. The key will let us determine
			//  whether a new tab or an existing one needs to be opened.
			var derivedKey = this._keyDerivationFunction(URL);
			// Check whether a tab with this key is already present:
			var matchingTabs = this._tabsByKey.get(derivedKey);
			if (matchingTabs) {
				return this.switchToTab(matchingTabs[matchingTabs.length - 1]);
			}
			else {
				return this.openTab(URL);
			}
		};
		
		TabManager.prototype.changeTabURL = function changeTabURL(tab, oldURL, newURL) {
			// Derive the old and the new tab keys. We need to move the tab (index value) to a new index key.
			var oldKey = this._keyDerivationFunction(oldURL);
			var newKey = this._keyDerivationFunction(newURL);
			// Avoid unnecessary manipulation of the index:
			if (oldKey === newKey) {
				return;
			}
			this._tabsByKey.remove(oldKey, tab);
			this._tabsByKey.add(newKey, tab);
		};
		
		return TabManager;
	};
});
