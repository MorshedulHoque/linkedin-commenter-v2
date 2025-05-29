// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Function to check if cached data is still valid
function isCacheValid(cachedData) {
    if (!cachedData || !cachedData.lastUpdated) return false;
    return (Date.now() - cachedData.lastUpdated) < CACHE_DURATION;
}

// Function to update cache with new request count
function updateRequestCount(userId, newCount) {
    chrome.storage.local.get(['cachedUserData'], (result) => {
        if (result.cachedUserData) {
            const updatedData = {
                ...result.cachedUserData,
                request_count: newCount,
                lastUpdated: Date.now()
            };
            chrome.storage.local.set({
                cachedUserData: updatedData,
                requestCount: newCount
            });
        }
    });
}

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
                    name: decodeURIComponent(name),  // This is the name from the login flow
                    userId: userId,
                    requestCount: parseInt(requestCount, 10)
                }, function () {
                    if (chrome.runtime.lastError) {
                        console.error('Error setting local storage:', chrome.runtime.lastError);
                    } else {
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
        
        // First check if we have valid cached data
        chrome.storage.local.get(['cachedUserData'], (result) => {
            if (result.cachedUserData && isCacheValid(result.cachedUserData)) {
                // Return cached data immediately
                sendResponse(result.cachedUserData);
            }
            
            // Then fetch fresh data
            const fetchUrl = `https://dashboard.linkedgage.com/get_request_count/${userId}`;
            fetch(fetchUrl)
            .then(response => response.json())
            .then(data => {
                if (data.full_name && data.request_count !== undefined) {
                    console.log('Real-time full name:', data.full_name);
                    console.log('Real-time request count:', data.request_count);

                    const userData = {
                        full_name: data.full_name,
                        request_count: data.request_count,
                        lastUpdated: Date.now()
                    };

                    // Cache the data
                    chrome.storage.local.set({
                        name: data.full_name,
                        requestCount: data.request_count,
                        cachedUserData: userData
                    }, function () {
                        if (chrome.runtime.lastError) {
                            console.error('Error setting local storage:', chrome.runtime.lastError);
                        } else {
                            sendResponse(userData);
                        }
                    });
                } else {
                    console.error('Missing full_name or request_count in response');
                    sendResponse({ error: "Missing full_name or request_count in response" });
                }
            })
            .catch(error => {
                console.error('Error fetching request count:', error);
                // If we have cached data, return it even if expired
                if (result.cachedUserData) {
                    sendResponse(result.cachedUserData);
                } else {
                    sendResponse({ error: "Failed to fetch request count" });
                }
            });
        });
        return true;
    }
    else if (request.action === "updateRequestCount") {
        // Update cache immediately after generating a comment
        updateRequestCount(request.userId, request.newCount);
        sendResponse({ success: true });
        return true;
    }
    else if (request.action === "openDashboard") {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
        sendResponse({ status: "Dashboard opened" });
    }
});

// Periodically update cached data
setInterval(() => {
    chrome.storage.local.get(['userId', 'cachedUserData'], (result) => {
        if (result.userId && (!result.cachedUserData || !isCacheValid(result.cachedUserData))) {
            const fetchUrl = `https://dashboard.linkedgage.com/get_request_count/${result.userId}`;
            fetch(fetchUrl)
            .then(response => response.json())
            .then(data => {
                if (data.full_name && data.request_count !== undefined) {
                    chrome.storage.local.set({
                        name: data.full_name,
                        requestCount: data.request_count,
                        cachedUserData: {
                            full_name: data.full_name,
                            request_count: data.request_count,
                            lastUpdated: Date.now()
                        }
                    });
                }
            })
            .catch(error => console.error('Error updating cache:', error));
        }
    });
}, CACHE_DURATION);

// Pre-fetch data when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
    chrome.storage.local.get(['userId', 'cachedUserData'], (result) => {
        if (result.userId && (!result.cachedUserData || !isCacheValid(result.cachedUserData))) {
            const fetchUrl = `https://dashboard.linkedgage.com/get_request_count/${result.userId}`;
            fetch(fetchUrl)
            .then(response => response.json())
            .then(data => {
                if (data.full_name && data.request_count !== undefined) {
                    chrome.storage.local.set({
                        name: data.full_name,
                        requestCount: data.request_count,
                        cachedUserData: {
                            full_name: data.full_name,
                            request_count: data.request_count,
                            lastUpdated: Date.now()
                        }
                    });
                }
            })
            .catch(error => console.error('Error pre-fetching data:', error));
        }
    });
});