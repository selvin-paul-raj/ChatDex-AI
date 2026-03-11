/**
 * @fileoverview Platform detector for AI chat sites.
 * Returns CSS selectors, platform info, and theme colors based on current URL.
 */
const PLATFORM_SELECTORS = {
  chatgpt: {
    userMessage: 'div[data-message-author-role="user"]',
    aiMessage: 'div[data-message-author-role="assistant"]',
    chatTitle: 'title',
    chatContainer: 'main',
    stickyHeaderHeight: 64,
    theme: {
      accent: '#10a37f',
      accentHover: '#0d8c6d',
      headerBg: '#10a37f',
      headerText: '#fff',
      darkBg: '#212121',
      darkBorder: '#333',
      darkItem: '#2a2a2a',
      darkItemHover: '#353535',
      darkText: '#ececec',
      darkMuted: '#888'
    }
  },
  gemini: {
    userMessage: 'user-query-content',
    aiMessage: 'model-response',
    chatTitle: 'title',
    chatContainer: 'main',
    stickyHeaderHeight: 64,
    theme: {
      accent: '#4285f4',
      accentHover: '#3367d6',
      headerBg: '#4285f4',
      headerText: '#fff',
      darkBg: '#1e1f20',
      darkBorder: '#333537',
      darkItem: '#282a2c',
      darkItemHover: '#333537',
      darkText: '#e3e3e3',
      darkMuted: '#8e918f'
    }
  }
};

const PLATFORM_URL_MAP = [
  { pattern: /chatgpt\.com/, name: 'chatgpt' },
  { pattern: /gemini\.google\.com/, name: 'gemini' }
];

/**
 * Detects the current AI platform based on URL.
 * @returns {{ name: string, selectors: object } | null}
 */
function detectPlatform() {
  const url = window.location.href;
  for (const entry of PLATFORM_URL_MAP) {
    if (entry.pattern.test(url)) {
      return {
        name: entry.name,
        selectors: PLATFORM_SELECTORS[entry.name]
      };
    }
  }
  return null;
}

/**
 * Returns selectors for the current platform.
 * @returns {object | null}
 */
function getSelectors() {
  const platform = detectPlatform();
  return platform ? platform.selectors : null;
}

/**
 * Returns the platform name string.
 * @returns {string | null}
 */
function getPlatformName() {
  const platform = detectPlatform();
  return platform ? platform.name : null;
}
