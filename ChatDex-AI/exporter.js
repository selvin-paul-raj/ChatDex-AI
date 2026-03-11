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
 * Exports chat data as a professional PDF — direct file download.
 * Sends styled HTML to the server (pdfcrowd), receives PDF, triggers download.
 * @param {object} chatData - Chat data from gatherChatData().
 * @returns {Promise<void>}
 */
async function exportAsPDF(chatData) {
  if (!chatData || !chatData.conversation || chatData.conversation.length === 0) {
    throw new Error('Nothing to export');
  }

  const meta = chatData.metadata;
  const html = buildPdfDocument(meta, chatData.conversation);
  const filename = makeFilename(meta.platform, 'pdf');

  const resp = await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'PDF_GENERATE', html, serverUrl: ACS_CONFIG.SERVER_URL },
      resolve
    );
  });

  if (resp.error) {
    throw new Error(resp.error);
  }

  // Convert data URL to blob and download
  const byteString = atob(resp.dataUrl.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}



/**
 * Builds a complete styled HTML document for PDF print.
 */
function buildPdfDocument(meta, conversation) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHTMLForExport(meta.title)} — ChatDex AI</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
    font-size: 12.5px; color: #1a1a2e; line-height: 1.65; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  /* ── Header ── */
  .doc-header { margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid #3b82f6; }
  .doc-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; }
  .doc-meta { font-size: 10px; color: #64748b; }
  .doc-meta span { margin-right: 14px; }
  .doc-meta b { color: #475569; }
  /* ── Turns ── */
  .turn { margin-bottom: 10px; page-break-inside: avoid; }
  .turn-sep { border: none; height: 1px; background: #e2e8f0; margin: 12px 0; }
  /* ── User ── */
  .u-box { background: #eff6ff; border-left: 3px solid #3b82f6; border-radius: 0 4px 4px 0; padding: 8px 12px; margin-bottom: 8px; }
  .u-label { font-size: 9px; font-weight: 700; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .u-body { color: #1e293b; }
  /* ── AI ── */
  .a-label { font-size: 9px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .a-body { color: #334155; line-height: 1.7; }
  /* ── Typography ── */
  h1 { font-size: 17px; font-weight: 700; color: #0f172a; margin: 10px 0 4px; }
  h2 { font-size: 15px; font-weight: 700; color: #0f172a; margin: 8px 0 3px; }
  h3 { font-size: 13px; font-weight: 600; color: #1e293b; margin: 6px 0 2px; }
  h4 { font-size: 12.5px; font-weight: 600; color: #1e293b; margin: 5px 0 2px; }
  p { margin: 3px 0; }
  strong { font-weight: 700; }
  em { font-style: italic; color: #475569; }
  /* ── Code ── */
  pre {
    background: #1e293b; color: #e2e8f0;
    padding: 10px 12px; border-radius: 4px;
    font-family: Consolas, 'Courier New', monospace; font-size: 11px;
    line-height: 1.5; margin: 6px 0;
    white-space: pre-wrap; word-wrap: break-word;
    page-break-inside: avoid;
  }
  code {
    font-family: Consolas, 'Courier New', monospace;
    background: #f1f5f9; color: #be185d;
    padding: 1px 4px; border-radius: 3px; font-size: 11.5px;
  }
  pre code { background: none; color: inherit; padding: 0; }
  /* ── Tables ── */
  table { border-collapse: collapse; margin: 6px 0; width: 100%; font-size: 11.5px; page-break-inside: avoid; }
  th { background: #f1f5f9; font-weight: 600; color: #334155; text-align: left; padding: 6px 10px; border: 1px solid #cbd5e1; }
  td { padding: 5px 10px; border: 1px solid #e2e8f0; color: #475569; }
  tr:nth-child(even) td { background: #f8fafc; }
  /* ── Lists ── */
  ul, ol { padding-left: 20px; margin: 4px 0; }
  li { margin: 2px 0; color: #334155; }
  /* ── Blockquote ── */
  blockquote { border-left: 3px solid #6366f1; padding: 6px 12px; margin: 6px 0; background: #f8fafc; border-radius: 0 4px 4px 0; color: #475569; font-style: italic; }
  a { color: #2563eb; text-decoration: none; }
  /* ── Footer ── */
  .doc-footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 8px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
<div class="doc-header">
  <div class="doc-title">${escapeHTMLForExport(meta.title)}</div>
  <div class="doc-meta">
    <span><b>Platform:</b> ${escapeHTMLForExport(meta.platform)}</span>
    <span><b>Exported:</b> ${meta.exportedAt}</span>
    <span><b>Turns:</b> ${meta.totalTurns}</span>
  </div>
</div>
${buildPdfConversationHTML(conversation)}
<div class="doc-footer">Generated by ChatDex AI</div>
</body>
</html>`;
}

/**
 * Converts conversation array into professional HTML for PDF export.
 */
function buildPdfConversationHTML(conversation) {
  const parts = [];
  let currentTurn = 0;

  for (const entry of conversation) {
    if (entry.turn !== currentTurn) {
      if (currentTurn > 0) parts.push('</div><hr class="turn-sep">');
      currentTurn = entry.turn;
      parts.push('<div class="turn">');
    }
    if (entry.role === 'user') {
      parts.push(`<div class="u-box">`);
      parts.push(`<div class="u-label">&#128172; You</div>`);
      parts.push(`<div class="u-body">${markdownToHTML(entry.content)}</div>`);
      parts.push(`</div>`);
    } else {
      parts.push(`<div class="a-label">&#129302; AI Response</div>`);
      parts.push(`<div class="a-body">${markdownToHTML(entry.content)}</div>`);
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
