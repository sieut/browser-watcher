var currentPageInfo = {
	domain: '',
	startTime: null
};

var connectedTabId = [];
var currentTabId;

var onWindowFocusedPtr = onWindowFocused;
var onWindowBlurredPtr = onWindowBlurred;

function currentTabReceived(tab) {
	// Update currentTabId
	currentTabId = tab.id;

	// If tab hasn't done loading, then onUpdated will be called when it's done
	// so add this to avoid calling twice
	if (tab.status != "complete") {
		return;
	}

	// Only inject script if
	//		- Tab hasn't connected (=> it wouldn't appear in connectedTabId)
	//		- User is on a page (not newtab, settings, etc.)
	if (connectedTabId.indexOf(tab.id) == -1
			&& tab.url && getProtocol(tab.url) != "chrome:") {
		chrome.tabs.executeScript(tab.id, {code: '(' + contentScript + ')();'}, function() {
			chrome.tabs.sendMessage(tab.id, tab.id);
		});
	}

	var currentTabDomain = getDomain(tab.url);
	// If the user is still in the same domain, then don't do anything
	if (currentPageInfo.domain == currentTabDomain) {
		return;
	} else {
		// If the user was on a page (not newtab, settings, etc.)
		// then update their time spent on that page
		if (currentPageInfo.domain.length) {
			var timeSpent = new Date() - currentPageInfo.startTime;
			storeNewTimeSpent(currentPageInfo.domain, timeSpent);
		}

		// If the user is on a page (not newtab, settings, etc.) then update currentInfo
		if (getProtocol(tab.url) != "chrome:") {
			currentPageInfo.domain = currentTabDomain;
			currentPageInfo.startTime = new Date();
		}
		// Else set the info to null
		else {
			currentPageInfo.domain = '';
			currentPageInfo.startTime = null;
		}
	}
}

function onWindowFocused() {
	console.log('on Focused');
	// Get current tab and call currentTabReceived
	chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
		currentTabReceived(tabs[0]);
	});
}

function onWindowBlurred() {
	console.log('on Blurred');
	// Update time spent on current page
	if (currentPageInfo.domain.length) {
		var timeSpent = new Date() - currentPageInfo.startTime;
		storeNewTimeSpent(currentPageInfo.domain, timeSpent);
	}

	// Set info to null
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
		// If this domain is already in the storage, update with the existing value
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
	console.log('on Activated');

	// Prevent onFocused and onBlurred being called
	onWindowFocusedPtr = null;
	onWindowBlurredPtr = null;

	// Handle current tab
	chrome.tabs.get(activeInfo.tabId, currentTabReceived);

	// Use alarm to setTimeout and set onFocused and onBlurred ptrs again
	chrome.alarms.create("resetPtrs", {when: Date.now() + 100});
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	// Only save browsing data if current tab is updated
	if (currentTabId == tabId && changeInfo.status == "complete") {
		console.log('on Updated');
		// Already have the tab so don't have to get tab like onActivated
		currentTabReceived(tab);
	}
});

chrome.browserAction.onClicked.addListener(function() {
	// Output user's browsing data
	chrome.storage.local.get(null, function(result){console.log(result)});
});

chrome.runtime.onConnect.addListener(function(port) {
	console.log('on Connected');
	// Add listener to events
	port.onMessage.addListener(function(msg) {
		if (msg.event == "blur") {
			if (onWindowBlurredPtr) onWindowBlurredPtr();
		} else if (msg.event == "focus") {
			if (onWindowFocusedPtr) onWindowFocusedPtr();
		} else if (msg.tabId) {
			// Extension is told that tab is connected
			// record tabId into connectedTabId
			connectedTabId.push(msg.tabId);
		}
	});
});

// Reset onFocused and onBlurred ptrs
chrome.alarms.onAlarm.addListener(function(alarm) {
	onWindowFocusedPtr = onWindowFocused;
	onWindowBlurredPtr = onWindowBlurred;
})

// Content script to inject into current tab
// and tell the extension if chrome is blurred
function contentScript() {
	chrome.runtime.onMessage.addListener(function(message) {
		// Connect to the extension
		var port = chrome.runtime.connect();

		// Listeners
		window.addEventListener("blur", function() {
			port.postMessage({event: 'blur'});
		});
		window.addEventListener("focus", function() {
			port.postMessage({event: 'focus'});
		});

		// Tell the extension that this tab has been connected
		port.postMessage({tabId: message});
	})
}