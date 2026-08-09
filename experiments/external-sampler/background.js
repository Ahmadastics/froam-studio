chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url || !/^https?:/.test(tab.url)) return
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['sampler.js'] })
})
