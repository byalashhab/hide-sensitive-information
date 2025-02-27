const dataTypeAttribute = "data-hide-sensitive-information-type";
let isHiddenGlobal = false;
let throttleTimer = null;

// Run as soon as possible - even before DOM is fully loaded
executeEarly();

// Create an observer instance that will run only once for initial load
const initialObserver = new MutationObserver((mutations) => {
  try {
    // Process immediately without disconnecting first for speed
    if (isHiddenGlobal) {
      requestAnimationFrame(() => {
        toggleEmail();
      });
    }
  } catch (error) {
    console.log("Error in mutation observer:", error);
  }
});

// Create a continuous observer to detect new content
const contentObserver = new MutationObserver((mutations) => {
  if (!isHiddenGlobal) return; // Only process if hiding is enabled

  // Throttle processing to prevent performance issues
  if (!throttleTimer) {
    throttleTimer = setTimeout(() => {
      throttleTimer = null;
      toggleEmail(); // Process any new content
    }, 10);
  }
});

// Execute as early as possible
function executeEarly() {
  // Try to get the state immediately
  chrome.storage.sync.get("isHidden", (data) => {
    handleState(data.isHidden);

    // Execute immediately if we can
    if (data.isHidden && document.body) {
      requestAnimationFrame(() => {
        toggleEmail();
      });
    }
  });

  // Add fastest possible listeners
  document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.sync.get("isHidden", (data) => {
      handleState(data.isHidden);
      if (data.isHidden) {
        requestAnimationFrame(() => {
          toggleEmail();
        });
      }
    });
  });
}

// Initial check directly
chrome.storage.sync.get("isHidden", (data) => {
  handleState(data.isHidden);

  // Set up observers immediately
  if (document.body) {
    // Start observing for both initial and continuous changes
    initialObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Start the continuous observer for dynamic content
    setupContinuousObservation();
  } else {
    // If body isn't ready, wait for it
    const checkBodyInterval = setInterval(() => {
      if (document.body) {
        clearInterval(checkBodyInterval);

        initialObserver.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
        });

        setupContinuousObservation();
      }
    }, 5);
  }

  // Also run when the page is fully loaded for any missed content
  window.addEventListener("load", () => {
    if (data.isHidden) {
      requestAnimationFrame(() => {
        toggleEmail();
      });
    }
  });
});

// Set up monitoring for URL/navigation changes
function setupNavigationMonitoring() {
  // Listen for popstate events (back/forward navigation)
  window.addEventListener("popstate", () => {
    if (isHiddenGlobal) {
      requestAnimationFrame(() => {
        toggleEmail();
      });
    }
  });

  // Monitor pushState and replaceState calls
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function () {
    originalPushState.apply(this, arguments);
    if (isHiddenGlobal) {
      requestAnimationFrame(() => {
        toggleEmail();
      });
    }
  };

  history.replaceState = function () {
    originalReplaceState.apply(this, arguments);
    if (isHiddenGlobal) {
      requestAnimationFrame(() => {
        toggleEmail();
      });
    }
  };
}

// Set up continuous observation of DOM changes
function setupContinuousObservation() {
  // Start observing for dynamic content changes
  contentObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Set up navigation monitoring for SPA
  setupNavigationMonitoring();
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "change-hidden-mode") {
    handleState(request.isHidden);
  }
});

function handleState(hidden) {
  isHiddenGlobal = hidden; // Store the state globally

  if (hidden && document.body) {
    requestAnimationFrame(() => {
      toggleEmail();
    });
  }
}

function toggleEmail() {
  // email regex: https://stackoverflow.com/questions/201323/how-can-i-validate-an-email-address-using-a-regular-expression
  const emailRegex = RegExp(
    /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/g
  );

  // Process visible elements first - prioritize what the user sees
  processVisibleContent(emailRegex);

  // Then process everything else
  processAllContent(emailRegex);
}

// Process visible content first (in viewport)
function processVisibleContent(emailRegex) {
  // get email inputs by id, name and obviously type. this can include duplicates but we don't care
  const possibleEmailInputs = [
    ...document.querySelectorAll(`input[id="mail"]`),
    ...document.querySelectorAll(`input[id="email"]`),
    ...document.querySelectorAll(`input[id="mail_address"]`),
    ...document.querySelectorAll(`input[id="email_address"]`),
    ...document.querySelectorAll(`input[name="mail"]`),
    ...document.querySelectorAll(`input[name="email"]`),
    ...document.querySelectorAll(`input[name="mail_address"]`),
    ...document.querySelectorAll(`input[name="email_address"]`),
    ...document.querySelectorAll(`input[type="email"]`),
  ];

  // Handle input fields immediately
  for (const email of possibleEmailInputs) {
    const value = email.value;
    if (emailRegex.test(value)) {
      // Only change the type if not already processed
      if (!email.hasAttribute(dataTypeAttribute)) {
        email.setAttribute(dataTypeAttribute, email.type);
        email.type = "password";
      }
    }
  }

  // Try to find elements in the current viewport first
  try {
    const viewportHeight = window.innerHeight;
    const viewportElements = [];

    // Get all elements in the viewport
    const allElements = document.body.getElementsByTagName("*");
    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i];
      const rect = element.getBoundingClientRect();

      // Check if element is in viewport
      if (rect.top < viewportHeight && rect.bottom >= 0) {
        viewportElements.push(element);
      }
    }

    // Process viewport elements first
    viewportElements.forEach((element) => {
      replaceEmailsInTextNodes(element, emailRegex);
    });
  } catch (e) {
    // Fall back to default processing if viewport detection fails
    replaceEmailsInTextNodes(document.body, emailRegex);
  }
}

// Process all content after visible content
function processAllContent(emailRegex) {
  replaceEmailsInTextNodes(document.body, emailRegex);
}

// Function to safely traverse DOM and replace emails in text nodes only
function replaceEmailsInTextNodes(element, emailRegex) {
  if (!element) return;

  // Skip script and style elements entirely
  if (element.tagName === "SCRIPT" || element.tagName === "STYLE") {
    return;
  }

  // Process child nodes
  for (let i = 0; i < element.childNodes.length; i++) {
    const node = element.childNodes[i];

    // Text node processing
    if (node.nodeType === 3) {
      // Node.TEXT_NODE
      const text = node.nodeValue;
      if (emailRegex.test(text)) {
        node.nodeValue = text.replace(emailRegex, (match) => {
          return match
            .split("@")
            .map((part) => part.replace(/./g, "*"))
            .join("@");
        });
      }
    }
    // Element node - recursive traversal
    else if (node.nodeType === 1) {
      // Node.ELEMENT_NODE
      replaceEmailsInTextNodes(node, emailRegex);
    }
  }
}
