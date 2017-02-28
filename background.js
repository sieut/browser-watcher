var currentPageInfo = {
	domain: '',
	startTime: null
};

var connectedTabId = [];
var currentTabId;

var onWindowFocusedPtr = onWindowFocused;
var onWindowBlurredPtr = onWindowBlurred;

function currentTabReceived(tab) {
	if (connectedTabId.indexOf(tab.id) == -1
			&& tab.url && getProtocol(tab.url) != "chrome:") {
		chrome.tabs.executeScript(tab.id, {code: '(' + contentScript + ')();'}, function() {
			chrome.tabs.sendMessage(tab.id, tab.id);
		});
	}

	currentTabId = tab.id;

	var currentTabDomain = getDomain(tab.url);
	if (currentPageInfo.domain == currentTabDomain) {
		return;
	} else {
		if (currentPageInfo.domain.length) {
			var timeSpent = new Date() - currentPageInfo.startTime;
			storeNewTimeSpent(currentPageInfo.domain, timeSpent);
		}

		if (getProtocol(tab.url) != "chrome:") {
			currentPageInfo.domain = currentTabDomain;
			currentPageInfo.startTime = new Date();
		} else {
			currentPageInfo.domain = '';
			currentPageInfo.startTime = null;
		}
	}
}

function onWindowFocused() {
	chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
		currentTabReceived(tabs[0]);
	});
}

function onWindowBlurred() {
	var timeSpent = new Date() - currentPageInfo.startTime;
	storeNewTimeSpent(currentPageInfo.domain, timeSpent);

	currentPageInfo.domain = '';
	currentPageInfo.startTime = null;
}

function getProtocol(url) {
	if (!url) return "";
	return url.split("/")[0];
}

function getDomain(url) {
	if (!url) return "";
	return url.split("/")[2];
}

function storeNewTimeSpent(domain, timeSpent) {
	chrome.storage.local.get(domain, function(oldValue) {
		var totalTimeSpent;
		// If this domain is already in the storage
		if (Object.keys(oldValue).length) {
			totalTimeSpent = timeSpent / 1000 + oldValue[domain];
		} else {
			totalTimeSpent = timeSpent / 1000;
		}

		// Store to storage
		toStoreObject = {};
		toStoreObject[domain] = Math.round(totalTimeSpent);
		chrome.storage.local.set(toStoreObject);
	});
}

chrome.tabs.onActivated.addListener(function(activeInfo) {
	onWindowFocusedPtr = null;
	onWindowBlurredPtr = null;

	chrome.tabs.get(activeInfo.tabId, currentTabReceived);

	chrome.alarms.create("resetPtrs", {when: Date.now() + 500});
});

// TODO tab can be updated without being in focus
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	// Only save browsing data if current tab is updated
	if (currentTabId == tabId && changeInfo.status == "complete") {
		// Already have the tab so don't have to get tab like onActivated
		currentTabReceived(tab);
	}
});

chrome.browserAction.onClicked.addListener(function() {
	chrome.storage.local.get(null, function(result){console.log(result)});
});

chrome.runtime.onConnect.addListener(function(port) {
	port.onMessage.addListener(function(msg) {
		if (msg.event == "blur") {
			if (onWindowBlurredPtr) onWindowBlurredPtr();
		} else if (msg.event == "focus") {
			if (onWindowFocusedPtr) onWindowFocusedPtr();
		} else if (msg.tabId) {
			connectedTabId.push(msg.tabId);
		}
	});
});

chrome.alarms.onAlarm.addListener(function(alarm) {
	onWindowFocusedPtr = onWindowFocused;
	onWindowBlurredPtr = onWindowBlurred;
})

// Content script to inject into current tab
// and tell the extension if chrome is blurred
function contentScript() {
	chrome.runtime.onMessage.addListener(function(message) {
		var port = chrome.runtime.connect();

		window.addEventListener("blur", function() {
			port.postMessage({event: 'blur'});
		});

		window.addEventListener("focus", function() {
			port.postMessage({event: 'focus'});
		});

		port.postMessage({tabId: message});
	})
}