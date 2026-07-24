// Minimal service worker to keep the extension alive and handle tabCapture
// from a persistent context. The real work still happens in popup.js.

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SCMix Pro] Extension installed / updated.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  sendResponse({ received: true });
});
