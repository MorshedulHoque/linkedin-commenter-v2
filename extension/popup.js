document.addEventListener('DOMContentLoaded', () => {
    // Fetch user data from local storage
    chrome.storage.local.get(['name', 'isLoggedIn', 'userId'], (result) => {
        console.log('Storage Result:', result);

        // If logged in
        if (result.isLoggedIn && result.userId) {
            // Show post-login UI
            document.getElementById('preLogin').classList.add('hidden');
            document.getElementById('postLogin').classList.remove('hidden');

            // Fetch the latest full name and request count from the Flask backend
            fetchRequestCountAndName(result.userId);

            // Show the logout and dashboard buttons (remove the hidden class)
            document.getElementById('logout').classList.remove('hidden');
            document.getElementById('openDashboard').classList.remove('hidden');
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
                const requestLimit = 10; // Define the limit here (10 requests per day)
                const requestsLeft = requestLimit - response.request_count; // Calculate how many requests are left

                // Update the UI with the latest full name, request count, and how many requests are left
                document.getElementById('userName').textContent = response.full_name;
                document.getElementById('requestCount').textContent = 'Total requests made: ' + response.request_count;
                document.getElementById('requestsLeft').textContent = 'Requests left today: ' + requestsLeft;

                // Optionally update local storage with the new full name and request count
                chrome.storage.local.set({
                    name: response.full_name,
                    requestCount: response.request_count
                });
            } else {
                console.error('Error fetching full name or request count');
            }
        });
    }

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
        chrome.storage.local.remove(['name', 'isLoggedIn', 'userId', 'requestCount'], () => {
            document.getElementById('preLogin').classList.remove('hidden');
            document.getElementById('postLogin').classList.add('hidden');
        });
    });

    // Dashboard button event listener
    document.getElementById('openDashboard').addEventListener('click', function() {
        chrome.tabs.create({ url: 'http://127.0.0.1:5000/dashboard' });
    });
});
