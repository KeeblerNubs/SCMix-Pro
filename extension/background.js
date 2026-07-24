// SCMix Pro — Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SCMix Pro] Extension installed / updated.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  sendResponse({ received: true });
});
