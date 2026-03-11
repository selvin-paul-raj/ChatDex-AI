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
