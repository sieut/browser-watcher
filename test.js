var currentPageInfo = {
	domain: '',
	startTime: null
};

function currentTabReceived(tab) {
	var currentTabDomain = getDomain(tab.url);
	if (currentPageInfo.domain == currentTabDomain) {
		return;
	} else {
		if (currentPageInfo.domain.length) {
			var timeSpent = new Date() - currentPageInfo.startTime;
			storeNewTimeSpent(currentPageInfo.domain, timeSpent);
		}

		if (currentTabDomain != "newtab") {
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
});

chrome.browserAction.onClicked.addListener(function() {
	chrome.storage.local.get(null, function(result){console.log(result)});
});