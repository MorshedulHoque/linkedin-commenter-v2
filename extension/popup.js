document.addEventListener('DOMContentLoaded', () => {
    // Fetch user data from local storage
    chrome.storage.local.get(['name', 'isLoggedIn', 'userId', 'cachedUserData'], (result) => {
        console.log('Storage Result:', result);

        // If logged in
        if (result.isLoggedIn && result.userId) {
            // Show post-login UI
            document.getElementById('preLogin').classList.add('hidden');
            document.getElementById('postLogin').classList.remove('hidden');

            // Show the logout and dashboard buttons
            document.getElementById('logout').classList.remove('hidden');
            document.getElementById('openDashboard').classList.remove('hidden');

            // If we have cached data, show it immediately
            if (result.cachedUserData) {
                updateUI(result.cachedUserData);
            }

            // Then fetch fresh data
            fetchRequestCountAndName(result.userId);
        } else {
            // Show pre-login UI
            document.getElementById('preLogin').classList.remove('hidden');
            document.getElementById('postLogin').classList.add('hidden');
        }
    });

    // Function to fetch both full name and request count from Flask
    function fetchRequestCountAndName(userId) {
        // Send a message to background.js to get the real-time full name and request count
        chrome.runtime.sendMessage({ action: "fetchRealTimeRequestCount", userId: userId }, (response) => {
            if (response && response.full_name && response.request_count !== undefined) {
                updateUI(response);
            } else if (response && response.error) {
                console.error('Error:', response.error);
            }
        });
    }

    function updateUI(data) {
        document.getElementById('userName').textContent = data.full_name;
        document.getElementById('requestCount').textContent = 'Total requests made: ' + data.request_count;
        document.getElementById('requestsLeft').textContent = 'Requests left today: ' + (10 - data.request_count);
    }

    // Function to update request count immediately
    function updateRequestCountImmediately(userId, newCount) {
        chrome.runtime.sendMessage({ 
            action: "updateRequestCount", 
            userId: userId, 
            newCount: newCount 
        }, (response) => {
            if (response && response.success) {
                // Update UI with new count
                chrome.storage.local.get(['cachedUserData'], (result) => {
                    if (result.cachedUserData) {
                        updateUI(result.cachedUserData);
                    }
                });
            }
        });
    }

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.cachedUserData) {
            updateUI(changes.cachedUserData.newValue);
        }
    });

    // Login button event listener
    document.getElementById('login').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "login" }, (response) => {
            if (response.isLoggedIn) {
                location.reload(); // Refresh the page after login
            }
        });
    });

    // Logout button event listener
    document.getElementById('logout').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "logout" }, (response) => {
            if (!response.isLoggedIn) {
                location.reload(); // Refresh the page after logout
            }
        });
        chrome.storage.local.remove(['name', 'isLoggedIn', 'userId', 'requestCount', 'cachedUserData'], () => {
            document.getElementById('preLogin').classList.remove('hidden');
            document.getElementById('postLogin').classList.add('hidden');
        });
    });

    // Dashboard button event listener
    document.getElementById('openDashboard').addEventListener('click', function() {
        chrome.tabs.create({ url: 'https://dashboard.linkedgage.com/dashboard' });
    });
});