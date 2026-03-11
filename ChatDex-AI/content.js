/**
 * @fileoverview Main content script for ChatDex AI.
 * GitHub-style dark sidebar panel for ChatGPT & Gemini.
 */

(function () {
  'use strict';

  const INIT_DELAY_MS = 1500;

  let platform = null;
  let selectors = null;
  let promptIndex = [];
  let tabId = null;
  let observer = null;
  let urlCheckInterval = null;
  let currentUrl = window.location.href;
  let selectedPromptIds = new Set();
  let notionConnected = false;
  let settings = {
    autoOpenPanel: true,
    showTimestamps: true,
    addYamlFrontMatter: false
  };

  async function init() {
    try {
      platform = detectPlatform();
      if (!platform) return;
      selectors = platform.selectors;

      tabId = await getCurrentTabId();
      await loadSettings();
      await loadIndex();
      await checkNotionConnection();

      injectPanel();
      indexExistingMessages();
      startObserver();
      startUrlWatcher();
      listenForNotionChanges();
      updateBadge();

      setTimeout(() => {
        refreshAiResponses();
        indexExistingMessages();
        renderPanel();
      }, 3000);
    } catch (e) {
      console.error('[ACS] init() FAILED', e.message);
    }
  }

  async function loadSettings() {
    const saved = await storageGet('acs_settings', null);
    if (saved) settings = { ...settings, ...saved };
  }

  async function loadIndex() {
    if (!tabId) return;
    const saved = await storageGet(tabKey(tabId, 'index'), null);
    if (saved && Array.isArray(saved)) promptIndex = saved;
  }

  async function saveIndex() {
    if (!tabId) return;
    await storageSet(tabKey(tabId, 'index'), promptIndex);
  }

  async function checkNotionConnection() {
    const creds = await getNotionCredentials();
    notionConnected = !!creds;
  }

  function listenForNotionChanges() {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.acs_notion_token || changes.acs_notion_db_id) {
        checkNotionConnection().then(() => {
          renderNotionBar();
          updateSyncButton();
        });
      }
    });
  }

  // ── Keyboard Shortcut ──

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      e.stopPropagation();
      const panel = document.getElementById('acs-panel');
      const toggle = document.getElementById('acs-toggle');
      if (!panel) return;
      const collapsed = panel.classList.toggle('acs-collapsed');
      if (toggle) toggle.innerHTML = collapsed ? '<span class="acs-toggle-arrow">▶</span>' : '<span class="acs-toggle-arrow">◀</span>';
      storageSet('acs_panel_open', !collapsed);
    }
  }, true);

  // ── Indexing ──

  function indexExistingMessages() {
    if (!selectors) return;
    const userMessages = document.querySelectorAll(selectors.userMessage);
    const aiMessages = document.querySelectorAll(selectors.aiMessage);
    const existingTexts = new Set(promptIndex.map(p => p.fullText));

    userMessages.forEach((node, i) => {
      const text = extractText(node);
      if (!text || existingTexts.has(text)) return;
      let aiPreview = '';
      if (i < aiMessages.length) {
        aiPreview = truncateText(extractText(aiMessages[i]), 80);
      }
      addPromptToIndex(text, aiPreview);
    });

    renderPanel();
  }

  function refreshAiResponses() {
    if (!selectors) return;
    const aiMessages = document.querySelectorAll(selectors.aiMessage);
    promptIndex.forEach((p, i) => {
      if (!p.aiPreview && i < aiMessages.length) {
        p.aiPreview = truncateText(extractText(aiMessages[i]), 80);
      }
    });
    saveIndex();
  }

  function isUserMessage(node) {
    if (!selectors || !node || node.nodeType !== Node.ELEMENT_NODE) return false;
    return node.matches?.(selectors.userMessage) || node.querySelector?.(selectors.userMessage);
  }

  function getUserMessageElement(node) {
    if (!selectors || !node || node.nodeType !== Node.ELEMENT_NODE) return null;
    if (node.matches?.(selectors.userMessage)) return node;
    return node.querySelector?.(selectors.userMessage) || null;
  }

  const capturePrompt = debounce(function (node) {
    const msgEl = getUserMessageElement(node);
    if (!msgEl) return;
    const text = extractText(msgEl);
    if (!text || promptIndex.some(p => p.fullText === text)) return;

    addPromptToIndex(text, '');
    renderPanel();
    saveIndex();
    updateBadge();
    setTimeout(() => { refreshAiResponses(); renderPanel(); }, 2000);
  }, DEBOUNCE_DELAY);

  function addPromptToIndex(text, aiPreview) {
    promptIndex.push({
      id: promptIndex.length + 1,
      preview: truncateText(text, 60),
      fullText: text,
      aiPreview: aiPreview || '',
      timestamp: isoTimestamp()
    });
  }

  // ── Observer & URL Watcher ──

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (isUserMessage(node)) capturePrompt(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function startUrlWatcher() {
    if (urlCheckInterval) clearInterval(urlCheckInterval);
    window.addEventListener('popstate', handleUrlChange);
    urlCheckInterval = setInterval(() => {
      if (window.location.href !== currentUrl) handleUrlChange();
    }, 1000);
  }

  function handleUrlChange() {
    currentUrl = window.location.href;
    promptIndex = [];
    if (observer) observer.disconnect();
    setTimeout(() => {
      indexExistingMessages();
      startObserver();
      updateBadge();
    }, 1500);
  }

  function updateBadge() {
    if (!document.getElementById('acs-panel-root')) {
      const oldHost = document.getElementById('acs-shadow-host');
      if (oldHost) oldHost.remove();
      injectPanel();
      renderPanel();
    }
    safeSendMessage({ type: 'UPDATE_BADGE', count: promptIndex.length });
  }

  // ── Panel Injection ──

  function injectPanel() {
    if (document.getElementById('acs-panel-root')) return;
    if (!document.body || !document.documentElement) {
      setTimeout(injectPanel, 500);
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'acs-panel-root';
    panel.innerHTML = getPanelHTML();

    const container = document.createElement('div');
    container.id = 'acs-shadow-host';
    container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;pointer-events:none;';
    document.documentElement.appendChild(container);
    container.appendChild(panel);

    // Apply theme
    if (platform?.selectors?.theme) {
      const t = platform.selectors.theme;
      const rootEl = panel.querySelector('#acs-panel');
      if (rootEl) {
        rootEl.style.setProperty('--acs-accent', t.accent);
        rootEl.style.setProperty('--acs-accent-hover', t.accentHover);
        if (isDarkMode()) {
          rootEl.style.setProperty('--acs-bg', t.darkBg);
          rootEl.style.setProperty('--acs-bg-secondary', t.darkItem);
          rootEl.style.setProperty('--acs-border', t.darkBorder);
          rootEl.style.setProperty('--acs-text', t.darkText);
          rootEl.style.setProperty('--acs-text-muted', t.darkMuted);
          rootEl.style.setProperty('--acs-item-bg', t.darkItem);
          rootEl.style.setProperty('--acs-item-hover', t.darkItemHover);
        }
      }
    }

    setupPanelEvents(panel);

    storageGet('acs_panel_open', settings.autoOpenPanel).then(isOpen => {
      const el = panel.querySelector('#acs-panel');
      if (el) el.classList.toggle('acs-collapsed', !isOpen);
    });
  }

  function getPanelHTML() {
    const darkClass = isDarkMode() ? 'acs-dark' : '';
    const pName = platform?.name || '';
    const platformLabels = { chatgpt: 'ChatGPT', gemini: 'Gemini' };
    const label = platformLabels[pName] || 'ChatDex AI';

    return `
      <div id="acs-panel" class="acs-panel ${darkClass}">
        <div class="acs-header" id="acs-drag-handle">
          <div class="acs-header-left">
            <span class="acs-header-icon">
              <svg class="acs-whale-icon" viewBox="0 0 32 32" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="15" cy="18" rx="11" ry="8" fill="#4a9eff"/>
                <ellipse cx="13" cy="16" rx="7" ry="4" fill="#79c0ff" opacity="0.5"/>
                <ellipse cx="15" cy="21" rx="8" ry="4" fill="#a8d5ff" opacity="0.6"/>
                <path d="M24 16c2-3 4-6 3-8s-2 2-3 4" fill="#3d8bef" opacity="0.8"/>
                <circle cx="10" cy="16" r="1.4" fill="#1a3a5c"/>
                <circle cx="10.5" cy="15.5" r="0.5" fill="#fff"/>
                <path d="M8 20q3 3 6 0" stroke="#1a3a5c" stroke-width="1" fill="none" stroke-linecap="round"/>
                <path d="M15 10c0-3 1-6 1-6s1 3 1 6" fill="#58a6ff" opacity="0.7"/>
                <ellipse cx="13" cy="7" rx="1.2" ry="1.8" fill="#58a6ff" opacity="0.4"/>
                <ellipse cx="19" cy="8" rx="1" ry="1.5" fill="#58a6ff" opacity="0.4"/>
              </svg>
            </span>
            <span class="acs-header-title">${label}</span>
          </div>
          <div class="acs-header-right">
            <span class="acs-badge" id="acs-prompt-count">0</span>
            <button class="acs-collapse-btn" id="acs-toggle" title="Toggle (Ctrl+Alt+K)">
              <span class="acs-toggle-arrow">◀</span>
            </button>
          </div>
        </div>
        <div class="acs-body">
          <div class="acs-toolbar">
            <input type="text" id="acs-search" class="acs-search" placeholder="Search prompts..." autocomplete="off" />
          </div>
          <div class="acs-notion-bar" id="acs-notion-bar"></div>
          <div class="acs-list" id="acs-prompt-list"></div>
          <div class="acs-footer">
            <div class="acs-footer-actions">
              <div class="acs-export-dropdown" id="acs-export-dropdown">
                <button class="acs-foot-btn acs-btn-export" id="acs-export-btn" title="Export">
                  <span class="acs-export-icon">↓</span> Export <span class="acs-dropdown-caret">▾</span>
                </button>
                <div class="acs-export-menu" id="acs-export-menu">
                  <button class="acs-export-option" data-format="md"><span class="acs-format-dot acs-dot-md"></span>Markdown (.md)</button>
                  <button class="acs-export-option" data-format="json"><span class="acs-format-dot acs-dot-json"></span>JSON (.json)</button>
                  <button class="acs-export-option" data-format="pdf"><span class="acs-format-dot acs-dot-pdf"></span>PDF (.pdf)</button>
                </div>
              </div>
              <button class="acs-foot-btn acs-btn-sync" id="acs-sync-selected" title="Sync to Notion" disabled>Sync</button>
            </div>
            <button class="acs-foot-btn acs-btn-selectall" id="acs-select-all-btn">Select All</button>
          </div>
        </div>
      </div>
    `;
  }

  // ── Panel Events ──

  function setupPanelEvents(root) {
    const toggle = root.querySelector('#acs-toggle');
    const panel = root.querySelector('#acs-panel');
    const search = root.querySelector('#acs-search');
    const selectAllBtn = root.querySelector('#acs-select-all-btn');
    const syncBtn = root.querySelector('#acs-sync-selected');
    const exportBtn = root.querySelector('#acs-export-btn');
    const exportMenu = root.querySelector('#acs-export-menu');

    toggle?.addEventListener('click', () => {
      const collapsed = panel.classList.toggle('acs-collapsed');
      toggle.innerHTML = collapsed ? '<span class="acs-toggle-arrow">▶</span>' : '<span class="acs-toggle-arrow">◀</span>';
      storageSet('acs_panel_open', !collapsed);
    });

    // Export dropdown
    exportBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      exportMenu?.classList.toggle('acs-export-menu-open');
    });

    exportMenu?.querySelectorAll('.acs-export-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const format = opt.getAttribute('data-format');
        exportMenu.classList.remove('acs-export-menu-open');
        exportFromPanel(format);
      });
    });

    document.addEventListener('click', () => {
      exportMenu?.classList.remove('acs-export-menu-open');
    });

    search?.addEventListener('input', debounce((e) => {
      renderPanel(e.target.value);
    }, 200));

    selectAllBtn?.addEventListener('click', () => {
      if (selectedPromptIds.size === promptIndex.length) {
        selectedPromptIds.clear();
      } else {
        promptIndex.forEach(p => selectedPromptIds.add(p.id));
      }
      renderPanel(search?.value || '');
      updateSyncButton();
      updateSelectAll();
    });

    syncBtn?.addEventListener('click', () => syncSelectedToNotion());

    makeDraggable(panel, root.querySelector('#acs-drag-handle'));
  }

  function makeDraggable(panel, handle) {
    let isDragging = false;
    let startX, startY, startRight, startTop;

    handle?.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      startRight = window.innerWidth - rect.right;
      startTop = rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panel.style.right = Math.max(0, startRight - (e.clientX - startX)) + 'px';
      panel.style.top = Math.max(0, startTop + (e.clientY - startY)) + 'px';
    });

    document.addEventListener('mouseup', () => { isDragging = false; });
  }

  // ── Render ──

  function renderPanel(filter = '') {
    let list = document.getElementById('acs-prompt-list');
    let badge = document.getElementById('acs-prompt-count');

    if (!list || !badge) {
      const oldHost = document.getElementById('acs-shadow-host');
      if (oldHost) oldHost.remove();
      injectPanel();
      list = document.getElementById('acs-prompt-list');
      badge = document.getElementById('acs-prompt-count');
      if (!list) return;
    }

    // Render Notion bar
    renderNotionBar();

    if (badge) badge.textContent = promptIndex.length;

    const lowerFilter = filter.toLowerCase();
    const filtered = filter
      ? promptIndex.filter(p => p.fullText.toLowerCase().includes(lowerFilter) || (p.aiPreview || '').toLowerCase().includes(lowerFilter))
      : [...promptIndex];

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="acs-empty">
          <div class="acs-empty-text">No prompts yet</div>
          <div class="acs-empty-hint">Start chatting to see prompts here</div>
        </div>`;
      return;
    }

    list.innerHTML = filtered.map(p => {
      const checked = selectedPromptIds.has(p.id) ? 'checked' : '';
      const synced = p.notionSynced ? ' acs-synced' : '';
      const aiSub = p.aiPreview ? `<div class="acs-item-sub">${escapeHtml(p.aiPreview)}</div>` : '';
      const time = settings.showTimestamps ? `<span class="acs-item-time">${formatTime(p.timestamp)}</span>` : '';
      return `
      <div class="acs-item${synced}" data-id="${p.id}">
        <div class="acs-item-row">
          <div class="checkbox-wrapper-46">
            <input type="checkbox" class="inp-cbx acs-item-check" id="cbx-${p.id}" data-id="${p.id}" ${checked} />
            <label class="cbx" for="cbx-${p.id}"><span><svg width="12px" height="10px" viewBox="0 0 12 10"><polyline points="1.5 6 4.5 9 10.5 1"></polyline></svg></span></label>
          </div>
          <span class="acs-item-num">${p.id}</span>
          <span class="acs-item-text">${escapeHtml(p.preview)}</span>
          ${time}
        </div>
        ${aiSub}
        ${p.notionSynced ? '<span class="acs-synced-dot" title="Synced to Notion">✓</span>' : ''}
      </div>`;
    }).join('');

    // Attach events
    list.querySelectorAll('.acs-item-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = parseInt(cb.getAttribute('data-id'), 10);
        cb.checked ? selectedPromptIds.add(id) : selectedPromptIds.delete(id);
        updateSyncButton();
        updateSelectAll();
      });
    });

    list.querySelectorAll('.acs-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.closest('.checkbox-wrapper-46')) return;
        const id = parseInt(item.getAttribute('data-id'), 10);
        scrollToPrompt(id);
      });
    });
  }

  function renderNotionBar() {
    const bar = document.getElementById('acs-notion-bar');
    if (!bar) return;

    if (notionConnected) {
      bar.innerHTML = `<div class="acs-notion-connected"><span class="acs-notion-dot acs-dot-on"></span> Notion connected</div>`;
    } else {
      bar.innerHTML = `<div class="acs-notion-disconnected"><span class="acs-notion-dot acs-dot-off"></span> Notion not connected <button class="acs-notion-connect-btn" id="acs-notion-connect">Connect</button></div>`;
      bar.querySelector('#acs-notion-connect')?.addEventListener('click', () => {
        safeSendMessage({ type: 'OPEN_OPTIONS' });
      });
    }
  }

  function scrollToPrompt(promptId) {
    if (!selectors) return;
    const messages = document.querySelectorAll(selectors.userMessage);
    const index = promptId - 1;
    if (index >= 0 && index < messages.length) {
      messages[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
      messages[index].style.outline = '2px solid var(--acs-accent, #7c3aed)';
      setTimeout(() => { messages[index].style.outline = ''; }, 2000);
    }
  }

  function updateSyncButton() {
    const btn = document.getElementById('acs-sync-selected');
    if (!btn) return;
    const count = selectedPromptIds.size;
    btn.disabled = count === 0;
    btn.textContent = count > 0 ? `Sync (${count})` : 'Sync';
  }

  function updateSelectAll() {
    const btn = document.getElementById('acs-select-all-btn');
    if (!btn) return;
    if (selectedPromptIds.size === promptIndex.length && promptIndex.length > 0) {
      btn.textContent = 'Deselect';
    } else {
      btn.textContent = 'Select All';
    }
  }

  function showPanelStatus(msg, type = 'info') {
    const bar = document.getElementById('acs-notion-bar');
    if (!bar) return;
    if (type === 'loading') {
      bar.innerHTML = `<div class="acs-status acs-status-loading">${escapeHtml(msg)}<span class="acs-loading-dots"></span></div>`;
    } else {
      bar.innerHTML = `<div class="acs-status acs-status-${type}">${escapeHtml(msg)}</div>`;
    }
    if (type === 'success') {
      setTimeout(() => renderNotionBar(), 3000);
    }
  }

  // ── Notion Sync ──

  async function syncSinglePromptToNotion(promptId, btn) {
    const prompt = promptIndex.find(p => p.id === promptId);
    if (!prompt) return;
    btn.disabled = true;
    showPanelStatus('Syncing #' + promptId + '...', 'info');

    const turnData = gatherSingleTurn(promptId);
    const result = await syncPromptsToNotion(turnData, [prompt]);

    if (result.success) {
      prompt.notionSynced = true;
      saveIndex();
      renderPanel();
      showPanelStatus('Synced!', 'success');
    } else {
      showPanelStatus(result.error, 'error');
    }
  }

  async function syncSelectedToNotion() {
    if (selectedPromptIds.size === 0) return;
    const syncBtn = document.getElementById('acs-sync-selected');
    if (syncBtn) { syncBtn.disabled = true; syncBtn.textContent = 'Syncing...'; }

    const selectedPrompts = promptIndex.filter(p => selectedPromptIds.has(p.id));
    const turns = [];
    for (const p of selectedPrompts) turns.push(...gatherSingleTurn(p.id));

    showPanelStatus(`Syncing ${selectedPrompts.length} prompts...`, 'info');
    const result = await syncPromptsToNotion(turns, selectedPrompts);

    if (result.success) {
      selectedPrompts.forEach(p => { p.notionSynced = true; });
      selectedPromptIds.clear();
      saveIndex();
      renderPanel();
      updateSyncButton();
      updateSelectAll();
      showPanelStatus(`${selectedPrompts.length} synced!`, 'success');
    } else {
      showPanelStatus(result.error, 'error');
    }

    if (syncBtn) { syncBtn.disabled = false; syncBtn.textContent = 'Sync'; }
  }

  function gatherSingleTurn(promptId) {
    if (!selectors) return [];
    const userMessages = document.querySelectorAll(selectors.userMessage);
    const aiMessages = document.querySelectorAll(selectors.aiMessage);
    const idx = promptId - 1;
    const entries = [];
    if (idx < userMessages.length) {
      const text = extractText(userMessages[idx]);
      const prompt = promptIndex.find(p => p.id === promptId);
      if (text) entries.push({ turn: promptId, role: 'user', content: text, timestamp: prompt?.timestamp || isoTimestamp(), tags: [] });
    }
    if (idx < aiMessages.length) {
      const text = extractText(aiMessages[idx]);
      if (text) entries.push({ turn: promptId, role: 'assistant', content: text, timestamp: isoTimestamp() });
    }
    return entries;
  }

  async function syncPromptsToNotion(conversation, prompts) {
    if (conversation.length === 0) return { success: false, error: 'No content to sync' };
    const creds = await getNotionCredentials();
    if (!creds) return { success: false, error: 'Notion not connected' };

    const title = document.title || 'Untitled Chat';
    const chatData = {
      metadata: { title, platform: platform?.name || 'unknown', exportedAt: isoTimestamp(), totalTurns: prompts.length, tags: [] },
      conversation
    };
    return syncToNotion(chatData);
  }

  // ── Export ──

  function exportFromPanel(format) {
    const data = gatherChatData();
    if (!data || !data.conversation?.length) {
      showPanelStatus('Nothing to export yet', 'error');
      return;
    }
    // If prompts are selected, filter conversation to only those turns
    if (selectedPromptIds.size > 0) {
      data.conversation = data.conversation.filter(e => selectedPromptIds.has(e.turn));
      data.metadata.totalTurns = selectedPromptIds.size;
      if (!data.conversation.length) {
        showPanelStatus('Selected prompts have no content', 'error');
        return;
      }
    }
    try {
      if (format === 'md') {
        data.includeYaml = settings.addYamlFrontMatter;
        downloadFile(exportAsMarkdown(data), makeFilename(data.metadata.platform, 'md'), 'text/markdown');
      } else if (format === 'json') {
        downloadFile(exportAsJSON(data), makeFilename(data.metadata.platform, 'json'), 'application/json');
      } else if (format === 'pdf') {
        showPanelStatus('Generating PDF', 'loading');
        exportAsPDF(data).then(() => {
          showPanelStatus('Exported!', 'success');
        }).catch(err => {
          showPanelStatus(err.message, 'error');
        });
        return;
      }
      showPanelStatus('Exported!', 'success');
    } catch (e) {
      showPanelStatus(e.message, 'error');
    }
  }

  function gatherChatData() {
    if (!selectors) return null;
    const userMessages = document.querySelectorAll(selectors.userMessage);
    const aiMessages = document.querySelectorAll(selectors.aiMessage);
    const title = document.title || 'Untitled Chat';
    const conversation = [];
    const maxTurns = Math.max(userMessages.length, aiMessages.length);

    for (let i = 0; i < maxTurns; i++) {
      if (i < userMessages.length) {
        const text = extractText(userMessages[i]);
        if (text) conversation.push({ turn: i + 1, role: 'user', content: text, htmlContent: userMessages[i].innerHTML, timestamp: promptIndex[i]?.timestamp || isoTimestamp(), tags: [] });
      }
      if (i < aiMessages.length) {
        const text = extractText(aiMessages[i]);
        if (text) conversation.push({ turn: i + 1, role: 'assistant', content: text, htmlContent: aiMessages[i].innerHTML, timestamp: isoTimestamp() });
      }
    }

    return {
      metadata: { title, platform: platform?.name || 'unknown', exportedAt: isoTimestamp(), totalTurns: maxTurns, tags: [] },
      conversation
    };
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ── Messages ──

  try {
    chrome.runtime?.onMessage?.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'URL_CHANGED') { handleUrlChange(); sendResponse({ ok: true }); }
      else if (msg.type === 'GET_INDEX') { sendResponse({ index: promptIndex, platform: platform?.name }); }
      else if (msg.type === 'EXPORT_CHAT') { sendResponse(gatherChatData()); }
      else if (msg.type === 'SCROLL_TO') { scrollToPrompt(msg.promptId); sendResponse({ ok: true }); }
      else if (msg.type === 'SETTINGS_UPDATED') { loadSettings().then(() => renderPanel()); sendResponse({ ok: true }); }
      return true;
    });
  } catch (e) { /* listener setup failed */ }

  window.__ACS__ = { getIndex: () => promptIndex, getPlatform: () => platform?.name, gatherChatData, scrollToPrompt };

  // ── Init ──

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, INIT_DELAY_MS));
  } else {
    setTimeout(init, INIT_DELAY_MS);
  }
})();
