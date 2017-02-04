console.log("before clicked");

chrome.browserAction.onClicked.addListener(function() {
	console.log("clicked");

	var now = new Date();

	setTimeout(function() {
		var done = new Date();
		console.log(done - now);
	}, 10000);
});