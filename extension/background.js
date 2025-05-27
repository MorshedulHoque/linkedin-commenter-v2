chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "login") {
        const loginUrl = `https://dashboard.linkedgage.com/login?ext_id=${chrome.runtime.id}`;
        chrome.identity.launchWebAuthFlow({
            url: loginUrl,
            interactive: true
        }, (redirectUrl) => {
            if (chrome.runtime.lastError || !redirectUrl) {
                console.error("Authentication failed:", chrome.runtime.lastError);
                sendResponse({ error: "Login failed", message: chrome.runtime.lastError?.message });
                return;
            }

            const url = new URL(redirectUrl);
            const name = url.searchParams.get("name");
            const userId = url.searchParams.get("user_id");
            const requestCount = url.searchParams.get("request_count");

            if (name && userId && requestCount) {
                chrome.storage.local.set({
                    isLoggedIn: true,
                    name: decodeURIComponent(name),
                    userId: userId,
                    requestCount: parseInt(requestCount, 10)
                }, function () {
                    if (chrome.runtime.lastError) {
                        console.error('Error setting local storage:', chrome.runtime.lastError);
                    } else {
                        // Close only the login window
                        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                            if (tabs[0] && tabs[0].url.includes('dashboard.linkedgage.com/login')) {
                                chrome.tabs.remove(tabs[0].id);
                            }
                        });
                        sendResponse({
                            isLoggedIn: true,
                            name: decodeURIComponent(name),
                            userId: userId,
                            requestCount: parseInt(requestCount, 10)
                        });
                    }
                });
            } else {
                console.error("Missing parameters in the URL");
                sendResponse({ error: "Name, User ID, or Request Count not received", message: "Missing parameters in redirect URL." });
            }
        });
        return true;
    } 
    else if (request.action === "register") {
        const registerUrl = `https://dashboard.linkedgage.com/register?ext_id=${chrome.runtime.id}`;
        chrome.identity.launchWebAuthFlow({
            url: registerUrl,
            interactive: true
        }, (redirectUrl) => {
            if (chrome.runtime.lastError || !redirectUrl) {
                console.error("Registration failed:", chrome.runtime.lastError);
                sendResponse({ error: "Registration failed", message: chrome.runtime.lastError?.message });
                return;
            }
            sendResponse({ status: "Registration successful" });
        });
        return true;
    }
    else if (request.action === "logout") {
        fetch('https://dashboard.linkedgage.com/logout', {
            method: 'GET', // Assuming GET is acceptable for your logout route
            credentials: 'include' // Important to handle cookies if using session-based auth
        }).then(() => {
            chrome.storage.local.remove(['isLoggedIn', 'name', 'userId', 'requestCount'], () => {
                console.log('User logged out and local storage cleared.');
                sendResponse({ isLoggedIn: false, message: "Logged out successfully" });
            });
        }).catch(error => {
            console.error('Error during logout:', error);
            sendResponse({ error: "Logout failed", message: "Server-side logout failed" });
        });
        return true;
    }
    else if (request.action === "fetchRealTimeRequestCount") {
        const userId = request.userId;
        const fetchUrl = `https://dashboard.linkedgage.com/get_request_count/${userId}`;

        fetch(fetchUrl)
        .then(response => response.json())
        .then(data => {
            if (data.full_name && data.request_count !== undefined) {
                console.log('Real-time full name:', data.full_name);
                console.log('Real-time request count:', data.request_count);

                // Update the local storage with the updated full name and request count
                chrome.storage.local.set({
                    name: data.full_name,  // Update the name to always fetch the latest one
                    requestCount: data.request_count
                }, function () {
                    if (chrome.runtime.lastError) {
                        console.error('Error setting local storage:', chrome.runtime.lastError);
                    } else {
                        sendResponse({
                            full_name: data.full_name,
                            request_count: data.request_count
                        });
                    }
                });
            } else {
                console.error('Missing full_name or request_count in response');
                sendResponse({ error: "Missing full_name or request_count in response" });
            }
        })
        .catch(error => {
            console.error('Error fetching request count:', error);
            sendResponse({ error: "Failed to fetch request count" });
        });

        return true;
    }
    else if (request.action === "openDashboard") {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
        sendResponse({ status: "Dashboard opened" });
    }
});
