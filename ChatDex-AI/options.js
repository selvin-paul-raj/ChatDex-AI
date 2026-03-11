/* options.js — ChatDex AI options page logic (Notion OAuth flow) */

(function () {
  const $ = (s) => document.querySelector(s);

  const NOTION_API = 'https://api.notion.com/v1';

  const KEYS = {
    token: 'acs_notion_token',
    chatsDb: 'acs_notion_db_id',
    dbName: 'acs_notion_db_name',
    workspace: 'acs_notion_workspace',
    settings: 'acs_settings'
  };

  const DEFAULTS = {
    autoOpenPanel: true,
    showTimestamps: true,
    addYamlFrontMatter: false
  };

  let pollTimer = null;
  let pollTimeout = null;

  /* ── Load ────────────────────────────── */
  function load() {
    chrome.storage.local.get(
      [KEYS.token, KEYS.chatsDb, KEYS.dbName, KEYS.workspace, KEYS.settings],
      (data) => {
        if (data[KEYS.token] && data[KEYS.chatsDb]) {
          showConnected(
            data[KEYS.dbName] || 'AI Chats',
            data[KEYS.workspace] || ''
          );
        }

        const s = Object.assign({}, DEFAULTS, data[KEYS.settings] || {});
        $('#opt-autoopen').checked = s.autoOpenPanel;
        $('#opt-timestamps').checked = s.showTimestamps;
        $('#opt-yaml').checked = s.addYamlFrontMatter;
      }
    );
  }

  /* ── OAuth Login Flow ───────────────── */
  function login() {
    const cfg = typeof ACS_CONFIG !== 'undefined' ? ACS_CONFIG : {};
    if (!cfg.NOTION_CLIENT_ID || cfg.NOTION_CLIENT_ID === 'YOUR_NOTION_CLIENT_ID') {
      showConnectStatus('Extension not configured. Set NOTION_CLIENT_ID in config.js.', 'error');
      return;
    }

    // Generate random state for this auth session
    const state = crypto.randomUUID();

    const btn = $('#btn-login');
    btn.disabled = true;
    btn.textContent = 'Waiting for authorization...';
    showConnectStatus('A Notion authorization page will open. Please approve access.', 'info');

    // Build Notion OAuth URL
    const authUrl = 'https://api.notion.com/v1/oauth/authorize?' + new URLSearchParams({
      client_id: cfg.NOTION_CLIENT_ID,
      response_type: 'code',
      owner: 'user',
      redirect_uri: cfg.NOTION_REDIRECT_URI,
      state: state
    }).toString();

    // Open Notion auth in new tab
    chrome.tabs.create({ url: authUrl });

    // Poll Supabase for the token
    startPolling(state);
  }

  function startPolling(state) {
    const cfg = typeof ACS_CONFIG !== 'undefined' ? ACS_CONFIG : {};
    const baseUrl = cfg.SERVER_URL || cfg.SUPABASE_URL;
    const pollUrl = baseUrl + '/api/notion-token?state=' + encodeURIComponent(state);
    const interval = cfg.OAUTH_POLL_INTERVAL || 2000;
    const timeout = cfg.OAUTH_TIMEOUT || 300000;

    // Clear any existing poll
    stopPolling();

    pollTimer = setInterval(async () => {
      try {
        const resp = await fetch(pollUrl);
        const data = await resp.json();

        if (data.access_token) {
          stopPolling();
          await onTokenReceived(data.access_token, data.workspace_name || '');
        }
        // If data.pending === true, keep polling
      } catch (e) {
        // Network error, keep polling
        console.warn('Poll error:', e.message);
      }
    }, interval);

    // Timeout after configured duration
    pollTimeout = setTimeout(() => {
      stopPolling();
      showConnectStatus('Authorization timed out. Please try again.', 'error');
      resetLoginButton();
    }, timeout);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (pollTimeout) { clearTimeout(pollTimeout); pollTimeout = null; }
  }

  function resetLoginButton() {
    const btn = $('#btn-login');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Login with Notion';
    }
  }

  /* ── Token Received → Setup DB ──────── */
  async function onTokenReceived(token, workspaceName) {
    showConnectStatus('Connected! Setting up AI Chats database...', 'info');

    try {
      // Search for existing "AI Chats" database
      const searchResp = await notionFetch('/search', token, {
        query: 'AI Chats',
        filter: { value: 'database', property: 'object' },
        page_size: 5
      });

      let dbId = null;
      let dbName = 'AI Chats';

      for (const result of searchResp.results || []) {
        if (result.object === 'database') {
          const title = result.title?.[0]?.plain_text || '';
          if (title === 'AI Chats') {
            dbId = result.id;
            dbName = title;
            break;
          }
        }
      }

      // If no existing DB, create one
      if (!dbId) {
        showConnectStatus('Creating "AI Chats" database...', 'info');

        const pageSearch = await notionFetch('/search', token, {
          filter: { value: 'page', property: 'object' },
          page_size: 1
        });

        let parentPageId = null;
        if (pageSearch.results && pageSearch.results.length > 0) {
          parentPageId = pageSearch.results[0].id;
        }

        if (!parentPageId) {
          showConnectStatus('No pages found. Share a page with the integration in Notion, then reconnect.', 'error');
          resetLoginButton();
          return;
        }

        const createResp = await notionFetch('/databases', token, {
          parent: { type: 'page_id', page_id: parentPageId },
          title: [{ type: 'text', text: { content: 'AI Chats' } }],
          properties: {
            'Name': { title: {} },
            'Platform': { select: {
              options: [
                { name: 'chatgpt', color: 'green' },
                { name: 'gemini', color: 'blue' }
              ]
            }},
            'Tags': { multi_select: {} },
            'Date': { date: {} }
          }
        });

        dbId = createResp.id;
      }

      // Save credentials
      await chrome.storage.local.set({
        [KEYS.token]: btoa(token),
        [KEYS.chatsDb]: btoa(dbId),
        [KEYS.dbName]: dbName,
        [KEYS.workspace]: workspaceName
      });

      showConnected(dbName, workspaceName);
      showConnectStatus('', '');

      // Auto-open the Notion database page
      const notionDbUrl = 'https://www.notion.so/' + dbId.replace(/-/g, '');
      chrome.tabs.create({ url: notionDbUrl });

    } catch (e) {
      showConnectStatus('Database setup failed: ' + e.message, 'error');
      resetLoginButton();
    }
  }

  function disconnect() {
    stopPolling();
    chrome.storage.local.remove(
      [KEYS.token, KEYS.chatsDb, KEYS.dbName, KEYS.workspace],
      () => { showDisconnected(); }
    );
  }

  /* ── Save Settings ──────────────────── */
  function save() {
    const payload = {};
    payload[KEYS.settings] = {
      autoOpenPanel: $('#opt-autoopen').checked,
      showTimestamps: $('#opt-timestamps').checked,
      addYamlFrontMatter: $('#opt-yaml').checked
    };

    chrome.storage.local.set(payload, () => {
      showSaveStatus('Settings saved ✓', 'success');
    });
  }

  /* ── Notion API Helper ──────────────── */
  async function notionFetch(endpoint, token, body) {
    const cfg = typeof ACS_CONFIG !== 'undefined' ? ACS_CONFIG : {};
    const resp = await fetch(NOTION_API + endpoint, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Notion-Version': cfg.NOTION_API_VERSION || '2022-06-28'
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || 'Notion API error: ' + resp.status);
    }
    return resp.json();
  }

  /* ── UI Helpers ─────────────────────── */
  function showConnected(dbName, workspaceName) {
    $('#state-disconnected').classList.add('hidden');
    $('#state-connected').classList.remove('hidden');
    $('#connected-db-name').textContent = 'Database: ' + dbName;
    if (workspaceName) {
      $('#connected-workspace').textContent = 'Workspace: ' + workspaceName;
    }
    resetLoginButton();
  }

  function showDisconnected() {
    $('#state-connected').classList.add('hidden');
    $('#state-disconnected').classList.remove('hidden');
    resetLoginButton();
  }

  function showConnectStatus(msg, type) {
    const el = $('#connect-status');
    el.textContent = msg;
    el.className = 'connect-status ' + (type || '');
  }

  function showSaveStatus(msg, type) {
    const el = $('#save-status');
    el.textContent = msg;
    el.className = 'save-status ' + type;
    setTimeout(() => { el.textContent = ''; el.className = 'save-status'; }, 2500);
  }

  /* ── Events ──────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    load();

    $('#btn-login').addEventListener('click', login);
    $('#btn-disconnect').addEventListener('click', disconnect);
    $('#btn-save').addEventListener('click', save);

    // Help button — open setup guide
    $('#btn-help').addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://www.notion.so/my-integrations' });
    });

    // Review button
    $('#btn-review')?.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://chromewebstore.google.com/detail/ai-chat-suite' });
    });

    // Feedback button
    $('#btn-feedback')?.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://github.com/AIChatSuite/feedback/issues' });
    });
  });
})();
