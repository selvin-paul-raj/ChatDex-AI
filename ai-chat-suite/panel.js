/**
 * @fileoverview Panel script for AI Chat Suite side panel (standalone).
 * Used when panel.html is opened as a side panel via chrome.sidePanel API.
 */

(function () {
  'use strict';

  const list = document.getElementById('acs-prompt-list');
  const badge = document.getElementById('acs-prompt-count');
  const search = document.getElementById('acs-search');
  const toggle = document.getElementById('acs-toggle');
  const panel = document.getElementById('acs-panel');

  let cachedIndex = [];

  /**
   * Renders prompt entries in the panel list.
   * @param {Array} index - Prompt index data.
   * @param {string} [filter=''] - Search filter.
   */
  function render(index, filter = '') {
    cachedIndex = index;
    const lower = filter.toLowerCase();
    const filtered = filter
      ? index.filter(p => p.fullText.toLowerCase().includes(lower))
      : index;

    if (badge) badge.textContent = index.length;

    if (filtered.length === 0) {
      list.innerHTML = '<div class="acs-empty">No prompts indexed yet.</div>';
      return;
    }

    function esc(s) {
      const d = document.createElement('div');
      d.appendChild(document.createTextNode(s || ''));
      return d.innerHTML;
    }

    list.innerHTML = filtered.map(p => `
      <div class="acs-prompt-item" data-id="${p.id}">
        <div class="acs-prompt-header">
          <span class="acs-prompt-num">#${p.id}</span>
          ${(p.tags || []).map(t => `<span class="acs-tag" style="background:${esc(t.color)}">${esc(t.tag)}</span>`).join('')}
          <span class="acs-time">${p.timestamp ? new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        </div>
        <div class="acs-prompt-text">${esc(p.preview)}</div>
      </div>
    `).join('');

    list.querySelectorAll('.acs-prompt-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = parseInt(item.getAttribute('data-id'), 10);
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'SCROLL_TO', promptId: id });
          }
        });
      });
    });
  }

  /**
   * Fetches the index from the active tab's content script.
   */
  function fetchIndex() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_INDEX' }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.index) {
          render(response.index);
        }
      });
    });
  }

  // Search filtering
  search?.addEventListener('input', () => {
    render(cachedIndex, search.value);
  });

  // Toggle
  toggle?.addEventListener('click', () => {
    panel?.classList.toggle('acs-collapsed');
    toggle.textContent = panel?.classList.contains('acs-collapsed') ? '▶' : '◀';
  });

  // Poll for updates
  fetchIndex();
  setInterval(fetchIndex, 3000);
})();
