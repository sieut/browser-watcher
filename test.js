var currentPageInfo = {
	domain: '',
	startTime: null
};

function currentTabReceived(tab) {
	// Content script to inject into current tab
	// and tell the extension if chrome is blurred
	function contentScript() {
		var port = chrome.runtime.connect();

		window.addEventListener("blur", function() {
			console.log("on blur");
			port.postMessage({event: 'blur'});
		});

		window.addEventListener("focus", function() {
			console.log("on focus");
			port.postMessage({event: 'focus'});
		});
	}

	var currentTabDomain = getDomain(tab.url);
	if (currentPageInfo.domain == currentTabDomain) {
		return;
	} else {
		if (currentPageInfo.domain.length) {
			var timeSpent = new Date() - currentPageInfo.startTime;
			storeNewTimeSpent(currentPageInfo.domain, timeSpent);
		}

		if (getProtocol(tab.url) != "chrome") {
			chrome.tabs.executeScript(tab.id, {code: '(' + contentScript + ')();'});
			currentPageInfo.domain = currentTabDomain;
			currentPageInfo.startTime = new Date();
		} else {
			currentPageInfo.domain = '';
			currentPageInfo.startTime = null;
		}
	}
}

function getDomain(url) {
	return url.split("/")[2];
}

function storeNewTimeSpent(domain, timeSpent) {
	chrome.storage.local.get(domain, function(oldValue) {
		var totalTimeSpent;
		// If this domain is already in the storage
		if (Object.keys(oldValue).length) {
			totalTimeSpent = timeSpent / 1000 + oldValue[domain];
			console.log('timeSpent: ' + timeSpent + ' ,oldValue:' + oldValue[domain]);
		} else {
			totalTimeSpent = timeSpent / 1000;
		}

		// Store to storage
		toStoreObject = {};
		toStoreObject[domain] = Math.round(totalTimeSpent);
		chrome.storage.local.set(toStoreObject, function() {
			console.log('Updated time spent for domain ' + domain + ' with value ' + totalTimeSpent);
		});
	});
}

chrome.tabs.onActivated.addListener(function(activeInfo) {
	chrome.tabs.get(activeInfo.tabId, currentTabReceived);
	console.log('on actived');
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	// Already have the tab so don't have to get tab like onActivated
	currentTabReceived(tab);
	console.log('on updated');
});

chrome.windows.onFocusChanged.addListener(function(windowId) {
	console.log('on focus changed ' + windowId);

	if (windowId != chrome.windows.WINDOW_ID_NONE) {

	}
});

chrome.browserAction.onClicked.addListener(function() {
	chrome.storage.local.get(null, function(result){console.log(result)});
});

chrome.runtime.onConnect.addListener(function(port) {
	console.log('on connect');
	port.onMessage.addListener(function(msg) {
		console.log(msg);
	});
});