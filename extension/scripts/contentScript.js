chrome.storage.local.get(['isLoggedIn'], (result) => {
  if (result.isLoggedIn) {
    addIconsToCommentBoxes();
    console.log('User is logged in.');

    const observer = new MutationObserver(addIconsToCommentBoxes);
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    console.log('User is not logged in. Icons will not be added.');
  }
});

function addIconsToCommentBoxes() {
  const commentBoxes = document.querySelectorAll('.comments-comment-box__form');
  commentBoxes.forEach((commentBox) => {
    if (!commentBox.querySelector('.comment-helper-icon')) {
      const icon = document.createElement('img');
      // icon.src = "https://img.icons8.com/external-bearicons-outline-color-bearicons/64/external-Comment-customer-review-bearicons-outline-color-bearicons.png";
      icon.src = chrome.runtime.getURL('../icons/icon48.png'); // Use chrome.runtime.getURL
      icon.className = 'comment-helper-icon';
      icon.style.cursor = 'pointer';
      icon.style.float = 'right';
      icon.style.margin = '8px 4px 0px 9px';
      icon.style.width = '27px';
      icon.style.height = '27px';
      const emojiButton = commentBox.querySelector('.comments-comment-box-comment__text-editor');
      if (emojiButton) {
        emojiButton.parentNode.insertBefore(icon, emojiButton);
      }

      icon.addEventListener('click', () => {
        const postText = getPostText(commentBox);
        if (postText) {
          displayEmotionPopup(postText, commentBox);
        } else {
          console.log('Could not find the post text.');
        }
      });
    }
  });
}

function getPostText(commentBox) {
  const postContainer = commentBox.closest('.feed-shared-update-v2');
  if (!postContainer) return null;
  const postTextElement = postContainer.querySelector('.feed-shared-update-v2__description');
  return postTextElement ? postTextElement.innerText.trim() : null;
}

function displayEmotionPopup(postText, commentBox) {
  const emotions = [
    { text: "Informative", emoji: "📝", color: "#0073b1" },
    { text: "Funny", emoji: "😄", color: "#ffbe00" },
    { text: "Supportive", emoji: "👍", color: "#00a550" },
    { text: "Critical", emoji: "💬", color: "#ff5630" },
    { text: "Inquisitive", emoji: "❓", color: "#9157b3" }
  ];

  const popup = document.createElement("div");
  popup.style.position = "absolute";
  popup.style.background = "linear-gradient(135deg, #0c0c0c 0%, #001435 100%)";
  popup.style.border = "1px solid #080a0a";
  popup.style.padding = "15px";
  popup.style.zIndex = "1000";
  popup.style.width = "260px";
  popup.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.1)";
  popup.style.borderRadius = "8px";
  popup.style.fontFamily = "Arial, sans-serif";
  popup.style.fontSize = "14px";
  popup.style.color = "#333";
  popup.style.textAlign = "center";
  popup.style.opacity = "0";
  popup.style.transform = "translateY(20px)";
  popup.style.transition = "opacity 0.4s, transform 0.4s";

  const commentBoxRect = commentBox.getBoundingClientRect();
  popup.style.top = `${commentBoxRect.bottom + window.scrollY + 10}px`;
  popup.style.left = `${commentBoxRect.left + window.scrollX}px`;

  const closeButton = document.createElement("button");
  closeButton.textContent = "×";
  closeButton.style.position = "absolute";
  closeButton.style.top = "8px";
  closeButton.style.right = "10px";
  closeButton.style.border = "none";
  closeButton.style.background = "none";
  closeButton.style.color = "#888";
  closeButton.style.fontSize = "20px";
  closeButton.style.cursor = "pointer";

  closeButton.onclick = () => document.body.removeChild(popup);

  const title = document.createElement("h3");
  title.textContent = "Choose a Tone";
  title.style.color = "#ffffff";
  title.style.marginBottom = "15px";

  popup.appendChild(closeButton);
  popup.appendChild(title);

  emotions.forEach((emotion) => {
    const button = document.createElement("button");
    button.textContent = `${emotion.emoji} ${emotion.text}`;
    button.style.backgroundColor = emotion.color;
    button.style.color = "#fff";
    button.style.display = "flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.style.width = "90%";
    button.style.margin = "8px auto";
    button.style.padding = "8px 10px";
    button.style.border = "none";
    button.style.borderRadius = "5px";
    button.style.cursor = "pointer";
    button.style.fontSize = "14px";
    button.style.position = 'relative';
    button.style.transition = "transform 0.3s ease, background-color 0.3s ease"; // Transition for smooth zoom effect and background color change
    
    button.addEventListener('mouseover', () => {
      button.style.transform = "scale(1.1)"; // Zoom in when hovered
    });
  
    button.addEventListener('mouseout', () => {
      button.style.transform = "scale(1)"; // Return to normal when not hovered
    });
  
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      button.disabled = true;
      button.style.backgroundColor = '#ccc';
  
      const spinner = createSpinner();
      button.appendChild(spinner); // Add spinner to button
  
      try {
        await generateComment(postText, emotion, commentBox);
      } catch (error) {
        console.error('Error generating comment:', error);
      } finally {
        button.removeChild(spinner);
        button.style.backgroundColor = emotion.color;
        button.disabled = false;
      }
      document.body.removeChild(popup);
    });
  
    popup.appendChild(button);
  });
  
  document.body.appendChild(popup);
  requestAnimationFrame(() => {
    popup.style.opacity = "1";
    popup.style.transform = "translateY(0)";
  });
  

  document.body.appendChild(popup);
  requestAnimationFrame(() => {
    popup.style.opacity = "1";
    popup.style.transform = "translateY(0)";
  });

  // Close the popup when clicking outside
  document.addEventListener('click', function closePopup(event) {
    if (!popup.contains(event.target)) {
      document.body.removeChild(popup);
      document.removeEventListener('click', closePopup); // Remove the event listener
    }
  }, true);
}

// Function to add global spinner styles
function addSpinnerStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .loader {
      border: 2px solid #f3f3f3; /* Light grey */
      border-top: 2px solid #3498db; /* Blue */
      border-radius: 50%;
      width: 16px;
      height: 16px;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

// Ensure this function is called when the script runs
addSpinnerStyles();

function createSpinner() {
  const spinner = document.createElement('div');
  spinner.style.position = 'absolute';
  spinner.style.top = '50%';
  spinner.style.right = '10px';
  spinner.style.transform = 'translateY(-50%)';
  spinner.innerHTML = '<div class="loader"></div>';
  return spinner;
}

function showLimitReachedPopup() {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '10000';

  const popup = document.createElement('div');
  popup.style.position = 'relative'; // Essential for positioning the close button correctly
  popup.style.background = '#ffffff';
  popup.style.padding = '30px';
  popup.style.borderRadius = '10px';
  popup.style.boxShadow = '0 4px 8px rgba(0,0,0,0.25)';
  popup.style.textAlign = 'center';
  popup.style.width = '400px';
  popup.style.maxWidth = '90%';

  // Close icon/button
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;'; // Using the HTML entity for a multiplication sign to simulate a close icon
  closeButton.style.position = 'absolute';
  closeButton.style.top = '0px';
  closeButton.style.right = '9px';
  closeButton.style.border = 'none';
  closeButton.style.background = 'none';
  closeButton.style.color = '#aaa';
  closeButton.style.fontSize = '24px';
  closeButton.style.cursor = 'pointer';

  closeButton.onclick = function() {
    document.body.removeChild(overlay);
  };

  // Image element
  const image = document.createElement('img');
  image.src = 'https://img.icons8.com/color/48/property-with-timer.png';  // Replace with your actual image URL
  image.style.width = '80px'; // Adjust size as needed
  image.style.height = 'auto';
  image.style.marginBottom = '20px';

  const message = document.createElement('p');
  message.textContent = "Sorry, today's limit has been reached. Please wait until tomorrow.";
  message.style.fontSize = '18px';
  message.style.fontWeight = 'bold';  // Set the font weight to bold
  message.style.color = '#333333';
  message.style.margin = '0 auto 20px';
  message.style.lineHeight = '1.4';

  popup.appendChild(closeButton); // Add the close button to the popup
  popup.appendChild(image); // Add the image to the popup
  popup.appendChild(message);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  // Close on click outside
  overlay.addEventListener('click', function(event) {
    if (event.target === overlay) {
      document.body.removeChild(overlay);
    }
  });

  // Prevent popup from closing when clicking inside it
  popup.addEventListener('click', function(event) {
    event.stopPropagation();
  });
}

async function generateComment(postText, emotion, commentBox, popup) {
  try {
    const userId = await getUserId();
    const response = await fetch('https://api.linkedgage.com/generate-comment', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://www.linkedin.com'
      },
      credentials: 'include',
      mode: 'cors',
      body: JSON.stringify({ text: postText, emotion: emotion.text, user_id: userId })
    });

    if (response.status === 429) {
      // Remove the current popup first, if it exists
      if (popup && popup.parentNode) {
        document.body.removeChild(popup);
      }
      // Show custom limit reached popup
      showLimitReachedPopup();
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.text();
    const commentEditor = commentBox.querySelector('.ql-editor');
    if (commentEditor) {
      commentEditor.innerText = result;
    }
  } catch (error) {
    console.error('Error during comment generation:', error);
    // Show error to user
    const errorMessage = document.createElement('div');
    errorMessage.style.color = 'red';
    errorMessage.style.padding = '10px';
    errorMessage.textContent = 'Failed to generate comment. Please try again.';
    commentBox.appendChild(errorMessage);
    setTimeout(() => errorMessage.remove(), 3000);
  } finally {
    // Ensure the interaction popup is removed if it hasn't been already
    if (popup && popup.parentNode) {
      document.body.removeChild(popup);
    }
  }
}

function getUserId() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['userId'], (result) => {
      if (result.userId) {
        resolve(result.userId);
      } else {
        reject('User ID not found in local storage');
      }
    });
  });
}
