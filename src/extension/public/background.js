chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url || !tab.url.includes('linkedin.com')) {
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content-script.js'],
    });
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['style.css'],
    });
  } catch (error) {
    console.error('LinkedIn Post Formatter injection failed', error);
  }
});