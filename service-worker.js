chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ isHidden: false });
});

function toggleSensitiveInformation() {
  chrome.storage.sync.get("isHidden", (data) => {
    const newState = !data.isHidden;
    chrome.storage.sync.set({ isHidden: newState }, () => {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (!tab.url.includes("chrome://")) {
            chrome.tabs
              .sendMessage(tab.id, {
                action: "change-hidden-mode",
                isHidden: newState,
              })
              .catch((error) =>
                console.log("Error sending message to tab:", error)
              );
          }
        });
      });
    });
  });
}

chrome.action.onClicked.addListener((tab) => {
  if (!tab.url.includes("chrome://")) {
    toggleSensitiveInformation();
  }
});
