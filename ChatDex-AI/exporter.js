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
 * Exports chat data as a PDF file using the browser's print-to-PDF.
 * Builds a styled HTML document and opens it in a new window for printing.
 * @param {object} chatData - Chat data from gatherChatData().
 * @returns {Promise<void>}
 */
async function exportAsPDF(chatData) {
  if (!chatData || !chatData.conversation || chatData.conversation.length === 0) {
    throw new Error('Nothing to export');
  }

  const meta = chatData.metadata;
  const html = buildExportHTML(meta, chatData.conversation, 'pdf');
  const printWin = window.open('', '_blank', 'width=800,height=600');
  if (!printWin) throw new Error('Pop-up blocked — please allow pop-ups for this site');

  printWin.document.write(html);
  printWin.document.close();
  printWin.onload = () => {
    setTimeout(() => {
      printWin.print();
      // Don't close — user may cancel
    }, 400);
  };
}

/**
 * Exports chat data as a DOCX file.
 * Generates a Word-compatible HTML file with .docx extension.
 * @param {object} chatData - Chat data from gatherChatData().
 * @returns {Promise<void>}
 */
async function exportAsDOCX(chatData) {
  if (!chatData || !chatData.conversation || chatData.conversation.length === 0) {
    throw new Error('Nothing to export');
  }

  const meta = chatData.metadata;
  const bodyHTML = buildExportHTML(meta, chatData.conversation, 'docx');

  // Word-compatible MHTML with proper namespace
  const docContent = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.6; margin: 40px; }
  h1 { font-size: 18pt; color: #1a1a2e; border-bottom: 2px solid #4a9eff; padding-bottom: 6px; }
  h2 { font-size: 13pt; color: #2d3748; margin-top: 18pt; }
  .meta { font-size: 9pt; color: #666; margin-bottom: 16pt; }
  .user-label { color: #2563eb; font-weight: bold; font-size: 11pt; margin-top: 14pt; }
  .ai-label { color: #059669; font-weight: bold; font-size: 11pt; margin-top: 10pt; }
  .user-content { background: #eff6ff; padding: 8px 12px; border-left: 3px solid #3b82f6; margin: 4px 0 12px 0; }
  .ai-content { padding: 4px 0 12px 0; }
  .divider { border-top: 1px solid #e2e8f0; margin: 16pt 0; }
  pre { background: #f1f5f9; padding: 10px 14px; border-radius: 4px; font-family: Consolas, monospace; font-size: 9.5pt; overflow-x: auto; white-space: pre-wrap; }
  code { font-family: Consolas, monospace; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 9.5pt; }
  table { border-collapse: collapse; margin: 8px 0; }
  td, th { border: 1px solid #cbd5e1; padding: 4px 10px; font-size: 10pt; }
  th { background: #f1f5f9; }
  ul, ol { padding-left: 22px; }
  blockquote { border-left: 3px solid #94a3b8; padding-left: 12px; color: #475569; margin: 8px 0; }
</style>
</head>
<body>
<h1>${escapeHTMLForExport(meta.title)}</h1>
<div class="meta">Platform: ${escapeHTMLForExport(meta.platform)} &nbsp;|&nbsp; Exported: ${meta.exportedAt} &nbsp;|&nbsp; Turns: ${meta.totalTurns}</div>
${buildConversationHTML(chatData.conversation)}
</body>
</html>`;

  const blob = new Blob([docContent], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = makeFilename(meta.platform, 'docx');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Builds a full HTML document for PDF export or body HTML for DOCX.
 */
function buildExportHTML(meta, conversation, mode) {
  if (mode === 'pdf') {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHTMLForExport(meta.title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #1a1a1a; line-height: 1.7; padding: 32px 40px; }
  h1 { font-size: 22px; color: #1a1a2e; border-bottom: 2px solid #4a9eff; padding-bottom: 8px; margin-bottom: 6px; }
  .meta { font-size: 10px; color: #666; margin-bottom: 24px; }
  .turn { margin-bottom: 20px; page-break-inside: avoid; }
  .user-label { color: #2563eb; font-weight: 700; font-size: 12px; margin-bottom: 2px; }
  .ai-label { color: #059669; font-weight: 700; font-size: 12px; margin-bottom: 2px; margin-top: 8px; }
  .user-content { background: #eff6ff; padding: 10px 14px; border-left: 3px solid #3b82f6; border-radius: 4px; margin-bottom: 10px; white-space: pre-wrap; }
  .ai-content { padding: 2px 0; white-space: pre-wrap; }
  .divider { border: none; border-top: 1px solid #e2e8f0; margin: 18px 0; }
  pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 6px; font-family: 'SF Mono', Consolas, monospace; font-size: 11px; overflow-x: auto; margin: 8px 0; white-space: pre-wrap; }
  code { font-family: 'SF Mono', Consolas, monospace; background: #f1f5f9; padding: 1px 5px; border-radius: 3px; font-size: 11px; }
  table { border-collapse: collapse; margin: 8px 0; width: 100%; }
  td, th { border: 1px solid #cbd5e1; padding: 6px 12px; font-size: 11px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  ul, ol { padding-left: 24px; margin: 6px 0; }
  blockquote { border-left: 3px solid #94a3b8; padding-left: 14px; color: #475569; margin: 8px 0; font-style: italic; }
  @media print { body { padding: 20px; } .turn { page-break-inside: avoid; } }
</style>
</head>
<body>
<h1>${escapeHTMLForExport(meta.title)}</h1>
<div class="meta">Platform: ${escapeHTMLForExport(meta.platform)} &nbsp;•&nbsp; Exported: ${meta.exportedAt} &nbsp;•&nbsp; Turns: ${meta.totalTurns}</div>
${buildConversationHTML(conversation)}
</body>
</html>`;
  }
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
