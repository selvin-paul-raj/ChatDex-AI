/**
 * @fileoverview Popup script for ChatDex AI.
 * Handles stats display, export triggers, and settings management.
 */

(function () {
  'use strict';

  // DOM elements
  const platformBadge = document.getElementById('platform-badge');
  const statPrompts = document.getElementById('stat-prompts');
  const statWords = document.getElementById('stat-words');
  const btnMarkdown = document.getElementById('btn-markdown');
  const btnJson = document.getElementById('btn-json');
  const btnNotion = document.getElementById('btn-notion');
  const notionStatus = document.getElementById('notion-status');
  const btnOptions = document.getElementById('btn-options');

  let chatData = null;

  /**
   * Sends a message to the content script of the active tab.
   * @param {object} msg - Message to send.
   * @returns {Promise<any>}
   */
  function sendToContent(msg) {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return resolve(null);
        chrome.tabs.sendMessage(tabs[0].id, msg, (response) => {
          if (chrome.runtime.lastError) return resolve(null);
          resolve(response);
        });
      });
    });
  }

  /**
   * Loads data from the active tab and updates the popup UI.
   */
  async function loadData() {
    const indexResp = await sendToContent({ type: 'GET_INDEX' });
    const exportResp = await sendToContent({ type: 'EXPORT_CHAT' });

    if (indexResp) {
      const index = indexResp.index || [];
      const platform = indexResp.platform || '—';

      platformBadge.textContent = platform;
      statPrompts.textContent = `${index.length} prompts`;

      // Word count
      const totalWords = index.reduce((sum, p) => sum + (p.fullText || '').split(/\s+/).length, 0);
      statWords.textContent = `${totalWords.toLocaleString()} words`;
    }

    if (exportResp) {
      chatData = exportResp;
    }
  }

  // ── Export Handlers ──

  btnMarkdown?.addEventListener('click', async () => {
    if (!chatData) {
      chatData = await sendToContent({ type: 'EXPORT_CHAT' });
    }
    if (!chatData || !chatData.conversation?.length) {
      notionStatus.textContent = 'Nothing to export — start a chat first.';
      notionStatus.className = 'notion-status error';
      return;
    }
    try {
      const md = exportAsMarkdown(chatData);
      const filename = makeFilename(chatData.metadata.platform, 'md');
      downloadBlob(md, filename, 'text/markdown');
      notionStatus.textContent = 'Markdown exported!';
      notionStatus.className = 'notion-status success';
    } catch (e) {
      notionStatus.textContent = e.message;
      notionStatus.className = 'notion-status error';
    }
  });

  btnJson?.addEventListener('click', async () => {
    if (!chatData) {
      chatData = await sendToContent({ type: 'EXPORT_CHAT' });
    }
    if (!chatData || !chatData.conversation?.length) {
      notionStatus.textContent = 'Nothing to export — start a chat first.';
      notionStatus.className = 'notion-status error';
      return;
    }
    try {
      const json = exportAsJSON(chatData);
      const filename = makeFilename(chatData.metadata.platform, 'json');
      downloadBlob(json, filename, 'application/json');
      notionStatus.textContent = 'JSON exported!';
      notionStatus.className = 'notion-status success';
    } catch (e) {
      notionStatus.textContent = e.message;
      notionStatus.className = 'notion-status error';
    }
  });

  btnNotion?.addEventListener('click', async () => {
    if (!chatData) {
      chatData = await sendToContent({ type: 'EXPORT_CHAT' });
    }
    if (!chatData || !chatData.conversation?.length) {
      notionStatus.textContent = 'Nothing to export — start a chat first.';
      notionStatus.className = 'notion-status error';
      return;
    }

    btnNotion.disabled = true;
    notionStatus.textContent = 'Syncing to Notion...';
    notionStatus.className = 'notion-status';

    try {
      const result = await syncToNotion(chatData, (synced, total) => {
        notionStatus.textContent = `Syncing... ${synced}/${total} blocks`;
      });

      if (result.success) {
        notionStatus.textContent = 'Synced to Notion!';
        notionStatus.className = 'notion-status success';
      } else {
        notionStatus.textContent = result.error;
        notionStatus.className = 'notion-status error';
      }
    } catch (e) {
      notionStatus.textContent = e.message;
      notionStatus.className = 'notion-status error';
    } finally {
      btnNotion.disabled = false;
    }
  });

  // ── Options Page ──
  btnOptions?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  /**
   * Downloads content as a blob file.
   * @param {string} content - File content.
   * @param {string} filename - Filename.
   * @param {string} type - MIME type.
   */
  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename, saveAs: true }, () => {
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
  }

  /**
   * Markdown export function (duplicated here for popup context).
   * @param {object} data - Chat data.
   * @returns {string}
   */
  function exportAsMarkdown(data) {
    const meta = data.metadata;
    const lines = [
      '---',
      `title: "${(meta.title || '').replace(/"/g, '\\"')}"`,
      `date: ${meta.exportedAt}`,
      `platform: ${meta.platform}`,
      `tags: [${(meta.tags || []).map(t => `"${t.replace(/"/g, '\\"')}"`).join(', ')}]`,
      '---', '', `# ${meta.title}`, ''
    ];
    let turn = 0;
    for (const entry of data.conversation) {
      if (entry.turn !== turn) {
        turn = entry.turn;
        lines.push(`## Turn ${turn}`, '');
      }
      const label = entry.role === 'user' ? '**User:**' : '**AI:**';
      lines.push(`${label} ${entry.content}`, '');
      if (entry.role === 'assistant') lines.push('---', '');
    }
    return lines.join('\n');
  }

  /**
   * JSON export function (duplicated here for popup context).
   * @param {object} data - Chat data.
   * @returns {string}
   */
  function exportAsJSON(data) {
    return JSON.stringify({
      metadata: data.metadata,
      conversation: data.conversation.map(e => ({
        turn: e.turn, role: e.role, content: e.content,
        timestamp: e.timestamp, ...(e.tags ? { tags: e.tags.map(t => t.tag) } : {})
      }))
    }, null, 2);
  }

  /**
   * Generates export filename.
   * @param {string} platform - Platform name.
   * @param {string} ext - Extension.
   * @returns {string}
   */
  function makeFilename(platform, ext) {
    const date = new Date().toISOString().split('T')[0];
    return `AI-Chat-${(platform || 'unknown').replace(/[^a-z0-9]/gi, '')}-${date}.${ext}`;
  }

  /**
   * Notion sync function for popup context.
   * @param {object} data - Chat data.
   * @param {Function} onProgress - Progress callback.
   * @returns {Promise<object>}
   */
  async function syncToNotion(data, onProgress) {
    const result = await chrome.storage.local.get(['acs_notion_token', 'acs_notion_db_id']);
    let token, dbId;
    try {
      token = result.acs_notion_token ? atob(result.acs_notion_token) : '';
      dbId = result.acs_notion_db_id ? atob(result.acs_notion_db_id) : '';
    } catch {
      return { success: false, error: 'Invalid credentials. Re-enter in Settings.' };
    }

    if (!token || !dbId) {
      return { success: false, error: 'Notion credentials not configured. Go to Settings.' };
    }

    const meta = data.metadata;
    const blocks = [];
    let turn = 0;
    for (const entry of data.conversation) {
      if (entry.turn !== turn) {
        turn = entry.turn;
        blocks.push({
          object: 'block', type: 'heading_2',
          heading_2: { rich_text: [{ type: 'text', text: { content: `Turn ${turn}` } }] }
        });
      }
      const label = entry.role === 'user' ? '👤 User' : '🤖 AI';
      const content = (entry.content || '').substring(0, 2000);
      blocks.push({
        object: 'block', type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: `${label}: ` }, annotations: { bold: true } },
            { type: 'text', text: { content } }
          ]
        }
      });
    }

    const CHUNK = 100;
    const firstChunk = blocks.slice(0, CHUNK);

    const resp = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: dbId },
        properties: {
          title: { title: [{ type: 'text', text: { content: meta.title || 'Untitled Chat' } }] },
          Platform: { select: { name: meta.platform || 'unknown' } },
          Tags: { multi_select: (meta.tags || []).map(t => ({ name: t })) },
          Date: { date: { start: meta.exportedAt.split('T')[0] } }
        },
        children: firstChunk
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return { success: false, error: err.message || `Notion API error: ${resp.status}` };
    }

    const page = await resp.json();
    if (onProgress) onProgress(Math.min(CHUNK, blocks.length), blocks.length);

    for (let i = 1; i < Math.ceil(blocks.length / CHUNK); i++) {
      await new Promise(r => setTimeout(r, 334));
      const chunk = blocks.slice(i * CHUNK, (i + 1) * CHUNK);
      await fetch(`https://api.notion.com/v1/blocks/${page.id}/children`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({ children: chunk })
      });
      if (onProgress) onProgress(Math.min((i + 1) * CHUNK, blocks.length), blocks.length);
    }

    return { success: true, url: page.url };
  }

  // Init
  loadData();
})();
