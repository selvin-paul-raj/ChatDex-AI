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
  const html = buildPdfHTML(meta, chatData.conversation);
  const filename = makeFilename(meta.platform, 'pdf');

  // Create a hidden container to render the HTML
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;z-index:-1;background:#fff;';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    await html2pdf()
      .set({
        margin: [0.4, 0.4, 0.4, 0.4],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      })
      .from(container)
      .save();
  } finally {
    document.body.removeChild(container);
  }
}



/**
 * Builds a professional HTML document for PDF rendering.
 */
function buildPdfHTML(meta, conversation) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHTMLForExport(meta.title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10.5pt; color: #1a1a2e; line-height: 1.7; padding: 48px 56px; background: #fff; }
  /* Header */
  .doc-header { margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
  .doc-title { font-size: 22pt; font-weight: 700; color: #0f172a; letter-spacing: -0.5px; margin-bottom: 8px; }
  .doc-meta { display: flex; gap: 20px; font-size: 8.5pt; color: #64748b; }
  .doc-meta-item { display: flex; align-items: center; gap: 5px; }
  .doc-meta-label { font-weight: 600; color: #475569; }
  /* Conversation */
  .turn-block { margin-bottom: 24px; page-break-inside: avoid; }
  .turn-separator { border: none; height: 1px; background: linear-gradient(to right, transparent, #cbd5e1, transparent); margin: 28px 0; }
  /* User prompt */
  .user-block { background: #f0f7ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px; }
  .user-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 9pt; font-weight: 600; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.5px; }
  .user-content { color: #1e293b; font-size: 10.5pt; line-height: 1.7; }
  /* AI response */
  .ai-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 9pt; font-weight: 600; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; }
  .ai-content { color: #334155; font-size: 10.5pt; line-height: 1.8; padding: 0 4px; }
  /* Typography */
  .ai-content h1, .ai-content h2, .ai-content h3, .ai-content h4 { color: #0f172a; margin: 16px 0 8px 0; }
  .ai-content h1 { font-size: 15pt; }
  .ai-content h2 { font-size: 13pt; }
  .ai-content h3 { font-size: 11.5pt; }
  .ai-content h4 { font-size: 10.5pt; }
  .ai-content p { margin: 6px 0; }
  .ai-content strong { font-weight: 600; color: #1e293b; }
  .ai-content em { font-style: italic; color: #475569; }
  /* Code */
  pre { background: #1e293b; color: #e2e8f0; padding: 16px 20px; border-radius: 8px; font-family: 'Fira Code', 'SF Mono', Consolas, monospace; font-size: 9pt; line-height: 1.6; overflow-x: auto; margin: 12px 0; white-space: pre-wrap; word-wrap: break-word; }
  code { font-family: 'Fira Code', 'SF Mono', Consolas, monospace; background: #f1f5f9; color: #be185d; padding: 2px 6px; border-radius: 4px; font-size: 9pt; }
  pre code { background: none; color: inherit; padding: 0; border-radius: 0; font-size: inherit; }
  /* Tables */
  table { border-collapse: collapse; margin: 12px 0; width: 100%; font-size: 9.5pt; }
  th { background: #f1f5f9; font-weight: 600; color: #334155; text-align: left; padding: 10px 14px; border: 1px solid #cbd5e1; }
  td { padding: 8px 14px; border: 1px solid #e2e8f0; color: #475569; }
  tr:nth-child(even) td { background: #f8fafc; }
  /* Lists */
  ul, ol { padding-left: 24px; margin: 8px 0; }
  li { margin: 4px 0; color: #334155; }
  li::marker { color: #6366f1; }
  /* Blockquotes */
  blockquote { border-left: 3px solid #6366f1; padding: 10px 16px; margin: 12px 0; background: #f8fafc; border-radius: 0 6px 6px 0; color: #475569; font-style: italic; }
  /* Links */
  a { color: #2563eb; text-decoration: none; }
  /* Footer */
  .doc-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 8pt; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
<div class="doc-header">
  <div class="doc-title">${escapeHTMLForExport(meta.title)}</div>
  <div class="doc-meta">
    <span class="doc-meta-item"><span class="doc-meta-label">Platform:</span> ${escapeHTMLForExport(meta.platform)}</span>
    <span class="doc-meta-item"><span class="doc-meta-label">Exported:</span> ${meta.exportedAt}</span>
    <span class="doc-meta-item"><span class="doc-meta-label">Turns:</span> ${meta.totalTurns}</span>
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
