/*global chrome, console, document*/
var urlQueue = [],
	tabsWaitingArray = [], // Tabs waiting for url update (before queuing)
	tabLimit = 6,
	// When a new tab is queued, it's instantly removed
	// this flag alerts not to open a new tab when this happens
	isQueuing = false,
	// Regular expressions for url exclusions
	whitelist = [/^chrome[:|-].*/],
	ICON_MAX_KEYS = 14;

function initOptions() {
	//sync.get callback, data received
	function dataRetrieved(items) {
		// Check for error
		if (chrome.runtime.lastError !== undefined) {
			console.log("An error ocurred initializing options: " + chrome.runtime.lastError.string);
			return;
		}
		// Initialize
		//Get icon parts and join them
		var iconString = '';
		for (var i = 0; i < ICON_MAX_KEYS; i++) {
			iconString += items['icon' + i];
		}
		chrome.browserAction.setIcon({
			path: iconString
		});
		// Badge counter
		chrome.browserAction.setBadgeBackgroundColor({
			color: "#ff0000"
		});
		chrome.browserAction.setBadgeText({
			text: urlQueue.length.toString()
		});
	}
	// Set defaults
	var options = {};
	//Generate the keys for the icon
	for (var i = 0; i < ICON_MAX_KEYS; i++) {
		//Clear the rest, in case the new icon is smaller
		options['icon' + i] = '';
	}
	options.icon0 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABmJLR0QA/wD/AP+gvaeTAAAAqElEQVR4nO3aQQrCQBBE0Y54/yOrW5GABI0fmfeWs2iKYtLMIjMAAMCKtpm5nzDz2afzT513+XDY31NAHaB23Tl7/ebe+fYO+anlb4AC6gC1vXeAHbASBdQBanvvgKOO7ozSNjO354Plb4AC6gA1BdQBagqoA9QUUAeoKaAOUFNAHaCmgDpATQF1gJoC6gA1BdQBagqoA9TO+Eforyx/AxRQBwAAACg8AEejCFAaFqVwAAAAAElFTkSuQmCC';
	// Get the items from storage (asynchronous)
	chrome.storage.sync.get(options, dataRetrieved);
}
// Settings changes
function onSettingsChanged(changes, namespace) {
	var key, storageChange, newValue, fullIcon = '';
	for (key in changes) {
		if (changes.hasOwnProperty(key)) {
			storageChange = changes[key];
			newValue = storageChange.newValue;
			if (key.match(/^icon[0-9]{1,2}$/) !== null) { //if is icon key, add
				fullIcon += newValue;
			}
		}
	}
	if (fullIcon !== '') {
		chrome.browserAction.setIcon({
			path: fullIcon
		});
	}
}
// Simply save the new tab id and check later when url gets updated
// this fixes the problem with blank url when opening a link with target="_blank"
function onCreatedTab(newTab) {
	tabsWaitingArray.push(newTab.id);
}

function findTabWaiting(tabId) {
	for (var i = 0; i < tabsWaitingArray.length; i++) {
		if (tabId === tabsWaitingArray[i]) {
			tabsWaitingArray.splice(i, 1);
			return true;
		}
	}
	return false;
}

function isInWhitelist(string) {
	for (var i = 0; i < whitelist.length; i++) {
		if (whitelist[i].test(string)) {
			return true;
		}
	}
	return false;
}

function updateBadgeCounter() {
	// Update badge count
	chrome.browserAction.setBadgeBackgroundColor({
		color: "#ff0000"
	});
	chrome.browserAction.setBadgeText({
		text: urlQueue.length.toString()
	});
}
// New tab created, check limit and add to queue
function onUpdatedTab(tabId, tabInfo) {
	//First check if the updated tab is one of the new ones
	if (!findTabWaiting(tabId)) {
		return;
	}
	// Get tabs in current window
	chrome.tabs.query({
		windowId: chrome.windows.WINDOW_ID_CURRENT
	}, function (windowTabs) {
		// Get number of opened tabs, whitelisted excluded
		var tabCount = 0;
		for (var i = 0; i < windowTabs.length; i++) {
			if (!isInWhitelist(windowTabs[i].url)) {
				tabCount++;
			}
		}
		// If no limit exceeded, do nothing
		// else add to urlQueue
		if (tabCount <= tabLimit) {
			return;
		} else {
			// Queue new tab url and close it
			if (!isInWhitelist(tabInfo.url)) {
				urlQueue.push(tabInfo.url);
				isQueuing = true;
				chrome.tabs.remove(tabId);
				updateBadgeCounter();
			}
		}
	});
}
// Tab removed, check if there's something in the queue
function onRemovedTab() {
	if (urlQueue.length > 0) {
		if (!isQueuing) {
			chrome.tabs.create({
				url: urlQueue.shift(),
				active: false
			}, function () {
				updateBadgeCounter();
			});
		}
		// Reset for the next one
		isQueuing = false;
	}
}
// LISTENERS
// "OnLoad" listener to set the default options
document.addEventListener('DOMContentLoaded', initOptions);
chrome.storage.onChanged.addListener(onSettingsChanged);
chrome.tabs.onCreated.addListener(onCreatedTab);
chrome.tabs.onRemoved.addListener(onRemovedTab);
chrome.tabs.onUpdated.addListener(onUpdatedTab);