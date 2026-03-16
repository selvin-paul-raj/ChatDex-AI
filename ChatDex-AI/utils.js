/**
 * @fileoverview Shared utility functions for ChatDex AI.
 */
const DEBOUNCE_DELAY = 300;
const MAX_RETRIES = 20;
const RETRY_INTERVAL = 500;

/**
 * Debounces a function call.
 * @param {Function} fn - Function to debounce.
 * @param {number} delay - Delay in ms.
 * @returns {Function}
 */
function debounce(fn, delay = DEBOUNCE_DELAY) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Waits for an element to appear in the DOM.
 * @param {string} selector - CSS selector.
 * @param {number} maxRetries - Max attempts.
 * @param {number} interval - Interval between retries in ms.
 * @returns {Promise<Element|null>}
 */
function waitForElement(selector, maxRetries = MAX_RETRIES, interval = RETRY_INTERVAL) {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      attempts++;
      if (attempts >= maxRetries) return resolve(null);
      setTimeout(check, interval);
    };
    check();
  });
}

/**
 * Truncates text to a maximum length.
 * @param {string} text - Input text.
 * @param {number} maxLen - Max length.
 * @returns {string}
 */
function truncateText(text, maxLen = 60) {
  if (!text) return '';
  const cleaned = text.trim().replace(/\s+/g, ' ');
  return cleaned.length > maxLen ? cleaned.substring(0, maxLen) + '...' : cleaned;
}

/**
 * Extracts text from a DOM node, preserving code blocks as fenced markdown.
 * @param {Element} node - DOM element.
 * @returns {string}
 */
function extractText(node) {
  if (!node) return '';
  const parts = [];
  const SKIP_TAGS = new Set(['button', 'svg', 'style', 'script', 'noscript', 'nav', 'footer']);

  function isToolbar(el) {
    if (el.tagName.toLowerCase() !== 'div' && el.tagName.toLowerCase() !== 'span') return false;
    if (el.querySelector('button') && !el.querySelector('p, pre, li, table, h1, h2, h3, h4, h5, h6')) return true;
    return false;
  }

  function walk(el) {
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        parts.push(child.textContent);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        if (SKIP_TAGS.has(tag)) continue;
        if (isToolbar(child)) continue;

        // Skip visually hidden elements used for screen readers (e.g. "You said:")
        if (child.className && typeof child.className === 'string') {
          const cName = child.className.toLowerCase();
          if (cName.includes('visually-hidden') || cName.includes('sr-only')) continue;
        }

        if (tag === 'pre') {
          const codeEl = child.querySelector('code');
          const lang = codeEl?.className?.match(/language-(\w+)/)?.[1] || '';
          const code = (codeEl || child).textContent || '';
          parts.push('\n```' + lang + '\n' + code.trim() + '\n```\n');
        } else if (tag === 'code' && !child.closest('pre')) {
          parts.push('`' + child.textContent + '`');
        } else if (tag === 'br') {
          parts.push('\n');
        } else if (tag === 'table') {
          parts.push('\n');
          const rows = child.querySelectorAll('tr');
          rows.forEach((row, ri) => {
            const cells = row.querySelectorAll('td, th');
            const cellTexts = Array.from(cells).map(c => c.textContent.trim());
            parts.push('| ' + cellTexts.join(' | ') + ' |\n');
            if (ri === 0) parts.push('| ' + cellTexts.map(() => '---').join(' | ') + ' |\n');
          });
          parts.push('\n');
        } else if (tag === 'ol') {
          parts.push('\n');
          let idx = 1;
          for (const li of child.children) {
            if (li.tagName.toLowerCase() === 'li') {
              parts.push(idx + '. ');
              walk(li);
              parts.push('\n');
              idx++;
            }
          }
        } else if (tag === 'ul') {
          parts.push('\n');
          for (const li of child.children) {
            if (li.tagName.toLowerCase() === 'li') {
              parts.push('- ');
              walk(li);
              parts.push('\n');
            }
          }
        } else if (tag === 'strong' || tag === 'b') {
          parts.push('**');
          walk(child);
          parts.push('**');
        } else if (tag === 'em' || tag === 'i') {
          parts.push('*');
          walk(child);
          parts.push('*');
        } else if (['h1','h2','h3','h4','h5','h6'].includes(tag)) {
          const level = parseInt(tag[1]);
          parts.push('\n' + '#'.repeat(level) + ' ');
          walk(child);
          parts.push('\n');
        } else if (tag === 'p' || tag === 'div') {
          parts.push('\n');
          walk(child);
          parts.push('\n');
        } else if (tag === 'li') {
          walk(child);
        } else {
          walk(child);
        }
      }
    }
  }

  walk(node);
  let result = parts.join('').replace(/\n{3,}/g, '\n\n').trim();

  // Strip common accessibility/screen-reader prefixes injected by platforms
  result = result.replace(/^(?:#+\s*)?You said\s*[:\n]*\s*/i, '');
  result = result.replace(/^(?:#+\s*)?(?:Gemini|ChatGPT|Claude|Assistant)\s*said\s*[:\n]*\s*/i, '');

  return result;
}

/**
 * Returns an ISO timestamp string.
 * @returns {string}
 */
function isoTimestamp() {
  return new Date().toISOString();
}

/**
 * Formats a timestamp for display.
 * @param {string} iso - ISO timestamp.
 * @returns {string}
 */
function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * Safely sends a message via chrome.runtime, handling invalidated contexts.
 * @param {object} message - Message payload.
 * @returns {Promise<any>}
 */
function safeSendMessage(message) {
  return new Promise((resolve) => {
    try {
      if (!chrome.runtime?.id) return resolve(null);
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('ChatDex AI: runtime message error', chrome.runtime.lastError.message);
          resolve(null);
        } else {
          resolve(response);
        }
      });
    } catch (e) {
      console.warn('ChatDex AI: extension context invalidated');
      resolve(null);
    }
  });
}

/**
 * Loads a value from chrome.storage.local.
 * @param {string} key - Storage key.
 * @param {*} defaultValue - Default if not found.
 * @returns {Promise<*>}
 */
async function storageGet(key, defaultValue = null) {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key] !== undefined ? result[key] : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Saves a value to chrome.storage.local.
 * @param {string} key - Storage key.
 * @param {*} value - Value to store.
 * @returns {Promise<void>}
 */
async function storageSet(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (e) {
    console.warn('ChatDex AI: storage write error', e.message);
  }
}

/**
 * Gets the current tab ID for namespacing storage.
 * @returns {Promise<number|null>}
 */
async function getCurrentTabId() {
  try {
    const response = await safeSendMessage({ type: 'GET_TAB_ID' });
    return response?.tabId ?? null;
  } catch {
    return null;
  }
}

/**
 * Creates a storage key namespaced by tab ID.
 * @param {number} tabId - Tab ID.
 * @param {string} key - Base key.
 * @returns {string}
 */
function tabKey(tabId, key) {
  return `tab_${tabId}_${key}`;
}

/**
 * Detects if dark mode is active.
 * @returns {boolean}
 */
function isDarkMode() {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return true;
  const body = document.body;
  if (body.classList.contains('dark') || body.getAttribute('data-theme') === 'dark') return true;
  const html = document.documentElement;
  if (html.classList.contains('dark') || html.getAttribute('data-theme') === 'dark') return true;
  return false;
}
