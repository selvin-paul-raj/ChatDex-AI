/**
 * @fileoverview Background service worker for ChatDex AI.
 * Handles tab events, badge updates, and message routing.
 */

// ── Tab URL Change Listener ──
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    chrome.tabs.sendMessage(tabId, { type: 'URL_CHANGED', url: changeInfo.url }).catch(() => {
      // Content script may not be loaded yet — ignore
    });
  }
});

// ── Message Handler ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'UPDATE_BADGE') {
    const count = msg.count || 0;
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.action.setBadgeText({ text: count > 0 ? String(count) : '', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#7c3aed', tabId });
    }
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'GET_TAB_ID') {
    sendResponse({ tabId: sender.tab?.id ?? null });
    return false;
  }

  if (msg.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }

  // ── PDF Generation Proxy (sends HTML to server, returns PDF blob URL) ──
  if (msg.type === 'PDF_GENERATE') {
    const { html, serverUrl } = msg;
    fetch(`${serverUrl}/api/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html })
    })
      .then(async (res) => {
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          sendResponse({ error: errBody.error || `Server error: ${res.status}` });
          return;
        }
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => sendResponse({ dataUrl: reader.result });
        reader.onerror = () => sendResponse({ error: 'Failed to read PDF' });
        reader.readAsDataURL(blob);
      })
      .catch((err) => {
        sendResponse({ error: err.message });
      });
    return true; // keep channel open for async response
  }

  // ── Notion API Proxy (avoids CORS from content scripts) ──
  if (msg.type === 'NOTION_API_PROXY') {
    const { endpoint, token, body, method } = msg;
    const url = `https://api.notion.com/v1${endpoint}`;
    fetch(url, {
      method: method || 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(body)
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          sendResponse({ error: data.message || `Notion API error: ${res.status}` });
        } else {
          sendResponse({ data });
        }
      })
      .catch((err) => {
        sendResponse({ error: err.message });
      });
    return true; // keep channel open for async response
  }
});

// ── Extension Install/Update ──
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      acs_settings: {
        autoOpenPanel: true,
        showTimestamps: true
      }
    });
  }
});

// ── Keep-alive for Manifest V3 service worker ──
// Service workers can be killed; all critical state is persisted in chrome.storage
