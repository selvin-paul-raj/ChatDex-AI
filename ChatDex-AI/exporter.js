/**
 * @fileoverview Export engine for ChatDex AI.
 * Exports chats as Markdown or JSON via chrome.downloads.
 */
/**
 * Generates a Markdown export from chat data.
 * @param {object} chatData - Chat data from gatherChatData().
 * @returns {string} Markdown content.
 */
function exportAsMarkdown(chatData) {
  if (!chatData || !chatData.conversation || chatData.conversation.length === 0) {
    throw new Error('Nothing to export');
  }

  const meta = chatData.metadata;
  const lines = [];

  if (chatData.includeYaml !== false) {
    lines.push(
      '---',
      `title: "${escapeYaml(meta.title)}"`,
      `date: ${meta.exportedAt}`,
      `platform: ${meta.platform}`,
      `tags: [${meta.tags.map(t => `"${escapeYaml(t)}"`).join(', ')}]`,
      '---',
      ''
    );
  }

  lines.push(`# ${meta.title}`, '');

  let currentTurn = 0;
  for (const entry of chatData.conversation) {
    if (entry.turn !== currentTurn) {
      currentTurn = entry.turn;
      lines.push(`## Turn ${currentTurn}`);
      lines.push('');
    }

    if (entry.role === 'user') {
      lines.push(`**User:** ${preserveCodeBlocks(entry.content)}`);
    } else {
      lines.push(`**AI:** ${preserveCodeBlocks(entry.content)}`);
    }
    lines.push('');
    if (entry.role === 'assistant') {
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Generates a JSON export from chat data.
 * @param {object} chatData - Chat data from gatherChatData().
 * @returns {string} JSON string.
 */
function exportAsJSON(chatData) {
  if (!chatData || !chatData.conversation || chatData.conversation.length === 0) {
    throw new Error('Nothing to export');
  }

  const output = {
    metadata: {
      title: chatData.metadata.title,
      platform: chatData.metadata.platform,
      exportedAt: chatData.metadata.exportedAt,
      totalTurns: chatData.metadata.totalTurns,
      tags: chatData.metadata.tags
    },
    conversation: chatData.conversation.map(entry => {
      const item = {
        turn: entry.turn,
        role: entry.role,
        content: entry.content,
        timestamp: entry.timestamp
      };
      if (entry.tags) {
        item.tags = entry.tags.map(t => t.tag);
      }
      return item;
    })
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Triggers a file download via blob URL.
 * @param {string} content - File content.
 * @param {string} filename - Suggested filename.
 * @param {string} mimeType - MIME type.
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  try {
    if (chrome.downloads?.download) {
      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
      }, () => {
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      });
    } else {
      // Fallback for content script context
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  } catch (e) {
    console.error('ChatDex AI: download failed', e);
  }
}

/**
 * Generates a safe filename for export.
 * @param {string} platform - Platform name.
 * @param {string} ext - File extension.
 * @returns {string}
 */
function makeFilename(platform, ext) {
  const date = new Date().toISOString().split('T')[0];
  const safePlatform = (platform || 'unknown').replace(/[^a-z0-9]/gi, '');
  return `AI-Chat-${safePlatform}-${date}.${ext}`;
}

/**
 * Preserves code blocks when converting to markdown.
 * Detects content that looks like code and wraps it.
 * @param {string} text - Input text.
 * @returns {string}
 */
function preserveCodeBlocks(text) {
  if (!text) return '';
  // Already has code fence markers preserved from DOM extraction
  return text;
}

/**
 * Escapes YAML special characters in strings.
 * @param {string} str - Input.
 * @returns {string}
 */
function escapeYaml(str) {
  if (!str) return '';
  return str.replace(/"/g, '\\"');
}

/**
 * Exports chat data as a professional PDF using html2pdf.js (client-side).
 * @param {object} chatData - Chat data from gatherChatData().
 * @returns {Promise<void>}
 */
async function exportAsPDF(chatData) {
  if (!chatData || !chatData.conversation || chatData.conversation.length === 0) {
    throw new Error('Nothing to export');
  }

  if (typeof html2pdf === 'undefined') {
    throw new Error('PDF library not loaded — reinstall the extension');
  }

  const meta = chatData.metadata;
  const { css, body } = buildPdfContent(meta, chatData.conversation);
  const filename = makeFilename(meta.platform, 'pdf');

  // Build container with scoped styles (not a full HTML doc)
  const container = document.createElement('div');
  container.id = 'chatdex-pdf-render';
  container.style.cssText = 'position:fixed;left:0;top:0;width:794px;background:#fff;z-index:2147483647;overflow:auto;';

  const styleEl = document.createElement('style');
  styleEl.textContent = '#chatdex-pdf-render{' + css.replace(/\n/g, '') + '}';
  container.appendChild(styleEl);

  const content = document.createElement('div');
  content.className = 'pdf-root';
  content.innerHTML = body;
  container.appendChild(content);
  document.body.appendChild(container);

  // Wait for fonts and images to load
  await new Promise(r => setTimeout(r, 300));

  try {
    await html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 794
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      })
      .from(content)
      .save();
  } finally {
    document.body.removeChild(container);
  }
}



/**
 * Builds CSS + body HTML for PDF rendering (not a full document).
 * Returns { css, body } for proper injection into a container div.
 */
function buildPdfContent(meta, conversation) {
  const css = `
  .pdf-root { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #1a1a2e; line-height: 1.7; padding: 32px 36px; background: #fff; }
  .pdf-root * { box-sizing: border-box; }
  .pdf-root .doc-header { margin-bottom: 28px; padding-bottom: 16px; border-bottom: 2px solid #e2e8f0; }
  .pdf-root .doc-title { font-size: 26px; font-weight: 700; color: #0f172a; letter-spacing: -0.3px; margin: 0 0 8px 0; }
  .pdf-root .doc-meta { display: flex; gap: 18px; font-size: 11px; color: #64748b; flex-wrap: wrap; }
  .pdf-root .doc-meta-item { display: inline-flex; align-items: center; gap: 4px; }
  .pdf-root .doc-meta-label { font-weight: 600; color: #475569; }
  .pdf-root .turn-block { margin-bottom: 20px; }
  .pdf-root .turn-separator { border: none; height: 1px; background: #cbd5e1; margin: 24px 0; }
  .pdf-root .user-block { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 16px; margin-bottom: 14px; }
  .pdf-root .user-header { margin-bottom: 6px; font-size: 11px; font-weight: 700; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.5px; }
  .pdf-root .user-content { color: #1e293b; font-size: 13px; line-height: 1.7; }
  .pdf-root .ai-header { margin-bottom: 8px; font-size: 11px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; }
  .pdf-root .ai-content { color: #334155; font-size: 13px; line-height: 1.8; padding: 0 2px; }
  .pdf-root .ai-content h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 14px 0 6px 0; }
  .pdf-root .ai-content h2 { font-size: 17px; font-weight: 700; color: #0f172a; margin: 12px 0 6px 0; }
  .pdf-root .ai-content h3 { font-size: 15px; font-weight: 600; color: #0f172a; margin: 10px 0 5px 0; }
  .pdf-root .ai-content h4 { font-size: 13px; font-weight: 600; color: #0f172a; margin: 8px 0 4px 0; }
  .pdf-root .ai-content p { margin: 5px 0; }
  .pdf-root .ai-content strong { font-weight: 700; color: #1e293b; }
  .pdf-root .ai-content em { font-style: italic; color: #475569; }
  .pdf-root pre { background: #1e293b; color: #e2e8f0; padding: 14px 16px; border-radius: 6px; font-family: Consolas, 'Courier New', monospace; font-size: 12px; line-height: 1.5; margin: 10px 0; white-space: pre-wrap; word-wrap: break-word; overflow-x: hidden; }
  .pdf-root code { font-family: Consolas, 'Courier New', monospace; background: #f1f5f9; color: #be185d; padding: 1px 5px; border-radius: 3px; font-size: 12px; }
  .pdf-root pre code { background: none; color: inherit; padding: 0; border-radius: 0; }
  .pdf-root table { border-collapse: collapse; margin: 10px 0; width: 100%; font-size: 12px; }
  .pdf-root th { background: #f1f5f9; font-weight: 600; color: #334155; text-align: left; padding: 8px 12px; border: 1px solid #cbd5e1; }
  .pdf-root td { padding: 7px 12px; border: 1px solid #e2e8f0; color: #475569; }
  .pdf-root tr:nth-child(even) td { background: #f8fafc; }
  .pdf-root ul, .pdf-root ol { padding-left: 22px; margin: 6px 0; }
  .pdf-root li { margin: 3px 0; color: #334155; }
  .pdf-root blockquote { border-left: 3px solid #6366f1; padding: 8px 14px; margin: 10px 0; background: #f8fafc; border-radius: 0 6px 6px 0; color: #475569; font-style: italic; }
  .pdf-root a { color: #2563eb; text-decoration: none; }
  .pdf-root .doc-footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
  `;

  const body = `
<div class="doc-header">
  <div class="doc-title">${escapeHTMLForExport(meta.title)}</div>
  <div class="doc-meta">
    <span class="doc-meta-item"><span class="doc-meta-label">Platform:</span> ${escapeHTMLForExport(meta.platform)}</span>
    <span class="doc-meta-item"><span class="doc-meta-label">Exported:</span> ${meta.exportedAt}</span>
    <span class="doc-meta-item"><span class="doc-meta-label">Turns:</span> ${meta.totalTurns}</span>
  </div>
</div>
${buildPdfConversationHTML(conversation)}
<div class="doc-footer">Generated by ChatDex AI</div>`;

  return { css, body };
}
}

/**
 * Converts conversation array into professional HTML for PDF export.
 */
function buildPdfConversationHTML(conversation) {
  const parts = [];
  let currentTurn = 0;

  for (const entry of conversation) {
    if (entry.turn !== currentTurn) {
      if (currentTurn > 0) parts.push('<hr class="turn-separator">');
      currentTurn = entry.turn;
      parts.push('<div class="turn-block">');
    }
    if (entry.role === 'user') {
      parts.push(`<div class="user-block">`);
      parts.push(`<div class="user-header">&#128172; You</div>`);
      parts.push(`<div class="user-content">${markdownToHTML(entry.content)}</div>`);
      parts.push(`</div>`);
    } else {
      parts.push(`<div class="ai-header">&#129302; AI Response</div>`);
      parts.push(`<div class="ai-content">${markdownToHTML(entry.content)}</div>`);
    }
  }
  if (currentTurn > 0) parts.push('</div>');
  return parts.join('\n');
}

/**
 * Converts conversation array into styled HTML for export.
 */
function buildConversationHTML(conversation) {
  const parts = [];
  let currentTurn = 0;

  for (const entry of conversation) {
    if (entry.turn !== currentTurn) {
      if (currentTurn > 0) parts.push('<hr class="divider">');
      currentTurn = entry.turn;
    }
    if (entry.role === 'user') {
      parts.push(`<div class="user-label">💬 You</div>`);
      parts.push(`<div class="user-content">${markdownToHTML(entry.content)}</div>`);
    } else {
      parts.push(`<div class="ai-label">🤖 AI Response</div>`);
      parts.push(`<div class="ai-content">${markdownToHTML(entry.content)}</div>`);
    }
  }
  return parts.join('\n');
}

/**
 * Basic markdown-to-HTML converter for export.
 * Handles code blocks, inline code, bold, italic, headings, lists, blockquotes, links.
 */
function markdownToHTML(text) {
  if (!text) return '';
  let html = escapeHTMLForExport(text);

  // Code blocks: ```lang\n...\n```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Headings
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Block quotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Unordered lists
  html = html.replace(/^[-*•] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Numbered lists
  html = html.replace(/^\d+[.)]\s(.+)$/gm, '<li>$1</li>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Paragraphs — replace double newlines
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}

/**
 * Escapes HTML special characters for export documents.
 */
function escapeHTMLForExport(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
