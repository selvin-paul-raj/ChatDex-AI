/**
 * @fileoverview Notion sync module for ChatDex AI.
 * Creates Notion pages from chat data via the Notion API.
 */
const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2022-06-28';
const NOTION_RATE_LIMIT_MS = 334; // ~3 requests/second

/**
 * Retrieves Notion credentials from storage.
 * @returns {Promise<{token: string, databaseId: string} | null>}
 */
async function getNotionCredentials() {
  const token = await storageGet('acs_notion_token', '');
  const databaseId = await storageGet('acs_notion_db_id', '');
  if (!token || !databaseId) return null;
  try {
    return { token: atob(token), databaseId: atob(databaseId) };
  } catch {
    return null;
  }
}

/**
 * Saves Notion credentials to storage (base64 encoded).
 * @param {string} token - Notion API token.
 * @param {string} databaseId - Notion database ID.
 */
async function saveNotionCredentials(token, databaseId) {
  await storageSet('acs_notion_token', btoa(token));
  await storageSet('acs_notion_db_id', btoa(databaseId));
}

/**
 * Makes a rate-limited request to the Notion API.
 * @param {string} endpoint - API endpoint path.
 * @param {string} token - Bearer token.
 * @param {object} body - Request body.
 * @returns {Promise<object>}
 */
async function notionRequest(endpoint, token, body, method = 'POST') {
  // Route through background service worker to avoid CORS
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        {
          type: 'NOTION_API_PROXY',
          endpoint,
          token,
          body,
          method
        },
        (response) => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          if (!response) {
            return reject(new Error('No response from background worker'));
          }
          if (response.error) {
            return reject(new Error(response.error));
          }
          resolve(response.data);
        }
      );
    } catch (e) {
      reject(new Error('Extension context invalidated'));
    }
  });
}

/**
 * Converts chat conversation to Notion blocks with professional formatting.
 * Creates a structured page with metadata header, table of contents, and
 * conversation turns formatted as callout blocks.
 * @param {Array} conversation - Chat conversation data.
 * @param {string} platformName - Platform name for theming.
 * @param {object} [metadata] - Optional metadata (title, date, totalTurns).
 * @returns {Array} Notion block objects.
 */
function conversationToNotionBlocks(conversation, platformName, metadata) {
  const blocks = [];
  const platformLabels = { chatgpt: 'ChatGPT', gemini: 'Gemini' };
  const platformLabel = platformLabels[platformName] || platformName || 'AI';
  const turnCount = metadata?.totalTurns || Math.max(...conversation.map(e => e.turn || 0), 0);

  let currentTurn = 0;
  for (const entry of conversation) {
    if (entry.turn !== currentTurn) {
      currentTurn = entry.turn;
      if (currentTurn > 1) {
        blocks.push({ object: 'block', type: 'divider', divider: {} });
      }
    }

    const content = (entry.content || '').trim();

    if (entry.role === 'user') {
      // ── USER PROMPT ── callout with blue tint
      blocks.push({
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: splitRichText(content.substring(0, 2000)),
          icon: { type: 'emoji', emoji: '💬' },
          color: 'blue_background'
        }
      });

      // Spacer
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [] }
      });
    } else {
      // ── AI RESPONSE ── label then native content blocks
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: `${platformLabel} Response` }, annotations: { color: 'gray' } }]
        }
      });

      const contentBlocks = formatContentBlocks(content);
      blocks.push(...contentBlocks);

      // Spacer after AI response
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [] }
      });
    }
  }

  return blocks;
}

/**
 * Formats content into Notion blocks, detecting code blocks and paragraphs.
 * @param {string} text - Raw content text.
 * @returns {Array} Notion block objects.
 */
function formatContentBlocks(text) {
  if (!text || !text.trim()) {
    return [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '(empty)' } }] } }];
  }

  const blocks = [];
  // Split by code fences
  const parts = text.split(/(```[\s\S]*?```)/g);

  for (const part of parts) {
    if (!part.trim()) continue;

    const codeMatch = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
    if (codeMatch) {
      const lang = codeMatch[1] || 'plain text';
      const code = codeMatch[2].trim();
      for (let i = 0; i < code.length; i += 2000) {
        blocks.push({
          object: 'block',
          type: 'code',
          code: {
            rich_text: [{ type: 'text', text: { content: code.substring(i, i + 2000) } }],
            language: lang
          }
        });
      }
    } else {
      // Process line by line for mixed content
      const lines = part.split('\n');
      let i = 0;
      while (i < lines.length) {
        const line = lines[i].trim();
        if (!line) { i++; continue; }

        // Markdown headings
        const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const hText = headingMatch[2].trim();
          const hType = level === 1 ? 'heading_1' : level === 2 ? 'heading_2' : 'heading_3';
          blocks.push({
            object: 'block',
            type: hType,
            [hType]: { rich_text: splitRichText(hText) }
          });
          i++;
          continue;
        }

        // Bulleted list — collect consecutive bullet items
        if (/^[\-\*•]\s/.test(line)) {
          while (i < lines.length && /^[\-\*•]\s/.test(lines[i].trim())) {
            const itemText = lines[i].trim().replace(/^[\-\*•]\s*/, '').trim();
            if (itemText) {
              blocks.push({
                object: 'block',
                type: 'bulleted_list_item',
                bulleted_list_item: { rich_text: splitRichText(itemText) }
              });
            }
            i++;
          }
          continue;
        }

        // Numbered list — collect consecutive numbered items
        if (/^\d+[.)\-]\s/.test(line)) {
          while (i < lines.length && /^\d+[.)\-]\s/.test(lines[i].trim())) {
            const itemText = lines[i].trim().replace(/^\d+[.)\-]\s*/, '').trim();
            if (itemText) {
              blocks.push({
                object: 'block',
                type: 'numbered_list_item',
                numbered_list_item: { rich_text: splitRichText(itemText) }
              });
            }
            i++;
          }
          continue;
        }

        // Block quote
        if (line.startsWith('> ')) {
          let quoteText = '';
          while (i < lines.length && lines[i].trim().startsWith('> ')) {
            quoteText += (quoteText ? '\n' : '') + lines[i].trim().replace(/^>\s?/, '');
            i++;
          }
          blocks.push({
            object: 'block',
            type: 'quote',
            quote: { rich_text: splitRichText(quoteText.substring(0, 2000)), color: 'default' }
          });
          continue;
        }

        // Regular paragraph — collect continuous non-empty, non-special lines
        let paraLines = [line];
        i++;
        while (i < lines.length) {
          const next = lines[i].trim();
          if (!next || /^#{1,3}\s/.test(next) || /^[\-\*•]\s/.test(next) || /^\d+[.)\-]\s/.test(next) || next.startsWith('> ')) break;
          paraLines.push(next);
          i++;
        }
        const paraText = paraLines.join(' ');
        for (let c = 0; c < paraText.length; c += 2000) {
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: { rich_text: splitRichText(paraText.substring(c, c + 2000)) }
          });
        }
      }
    }
  }

  return blocks.length > 0 ? blocks : [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '(empty)' } }] } }];
}

/**
 * Creates rich_text array with inline code and bold formatting.
 * @param {string} text - Text possibly containing `code` or **bold**.
 * @returns {Array} Notion rich_text objects.
 */
function splitRichText(text) {
  // Match: `code`, **bold**, *italic*, [link](url)
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|(?<!\*)\*(?!\*)[^*]+\*(?!\*)|\[[^\]]+\]\([^)]+\))/);
  const richText = [];
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('`') && part.endsWith('`')) {
      richText.push({ type: 'text', text: { content: part.slice(1, -1) }, annotations: { code: true } });
    } else if (part.startsWith('**') && part.endsWith('**')) {
      richText.push({ type: 'text', text: { content: part.slice(2, -2) }, annotations: { bold: true } });
    } else if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      richText.push({ type: 'text', text: { content: part.slice(1, -1) }, annotations: { italic: true } });
    } else {
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        richText.push({ type: 'text', text: { content: linkMatch[1], link: { url: linkMatch[2] } } });
      } else {
        richText.push({ type: 'text', text: { content: part } });
      }
    }
  }
  return richText.length > 0 ? richText : [{ type: 'text', text: { content: text } }];
}

/**
 * Syncs a chat to Notion. Sends blocks in chunks to handle large conversations.
 * @param {object} chatData - Chat data from gatherChatData().
 * @param {Function} [onProgress] - Progress callback (synced, total).
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function syncToNotion(chatData, onProgress) {
  if (!chatData || !chatData.conversation || chatData.conversation.length === 0) {
    return { success: false, error: 'Nothing to export' };
  }

  const creds = await getNotionCredentials();
  if (!creds) {
    return { success: false, error: 'Notion credentials not configured. Go to Settings to add your API token and Database ID.' };
  }

  const meta = chatData.metadata;
  const allBlocks = conversationToNotionBlocks(chatData.conversation, meta.platform, meta);
  const CHUNK_SIZE = 100; // Notion max children per request
  const totalChunks = Math.ceil(allBlocks.length / CHUNK_SIZE);

  try {
    // Create the page with first chunk of blocks
    const firstChunk = allBlocks.slice(0, CHUNK_SIZE);
    // Build properties — use 'Name' (the title property created by setup)
    const properties = {
      Name: {
        title: [{ type: 'text', text: { content: meta.title || 'Untitled Chat' } }]
      },
      Platform: {
        select: { name: meta.platform || 'unknown' }
      },
      Date: {
        date: { start: meta.exportedAt.split('T')[0] }
      }
    };

    const pagePayload = {
      icon: { type: 'emoji', emoji: '📝' },
      parent: { database_id: creds.databaseId },
      properties,
      children: firstChunk
    };

    let page;
    try {
      page = await notionRequest('/pages', creds.token, pagePayload);
    } catch (e) {
      // If database not found, try to recover by finding/creating it
      if (e.message && (e.message.includes('Could not find database') || e.message.includes('not found'))) {
        const newDbId = await recoverDatabase(creds.token);
        if (newDbId) {
          pagePayload.parent.database_id = newDbId;
          page = await notionRequest('/pages', creds.token, pagePayload);
        } else {
          return { success: false, error: 'Database not found. Please reconnect Notion in Settings.' };
        }
      } else if (e.message && e.message.includes('property')) {
        // If properties mismatch, retry with title only
        page = await notionRequest('/pages', creds.token, {
          icon: { type: 'emoji', emoji: '📝' },
          parent: { database_id: creds.databaseId },
          properties: {
            Name: { title: [{ type: 'text', text: { content: meta.title || 'Untitled Chat' } }] }
          },
          children: firstChunk
        });
      } else {
        throw e;
      }
    }

    if (onProgress) onProgress(Math.min(CHUNK_SIZE, allBlocks.length), allBlocks.length);

    // Append remaining chunks
    for (let i = 1; i < totalChunks; i++) {
      await new Promise(r => setTimeout(r, NOTION_RATE_LIMIT_MS));
      const chunk = allBlocks.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await notionRequest(`/blocks/${page.id}/children`, creds.token, {
        children: chunk
      }, 'PATCH');
      if (onProgress) onProgress(Math.min((i + 1) * CHUNK_SIZE, allBlocks.length), allBlocks.length);
    }

    return { success: true, url: page.url };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Recovers from a missing database by searching for or creating a new "AI Chats" DB.
 * Updates stored credentials with the new database ID.
 * @param {string} token - Notion API token.
 * @returns {Promise<string|null>} New database ID, or null if recovery failed.
 */
async function recoverDatabase(token) {
  try {
    // Search for existing "AI Chats" database
    const searchResp = await notionRequest('/search', token, {
      query: 'AI Chats',
      filter: { value: 'database', property: 'object' },
      page_size: 5
    });

    for (const result of (searchResp.results || [])) {
      if (result.object === 'database') {
        const title = result.title?.[0]?.plain_text || '';
        if (title === 'AI Chats') {
          await saveNotionCredentials(token, result.id);
          return result.id;
        }
      }
    }

    // No existing DB found — create one under the first available page
    const pageSearch = await notionRequest('/search', token, {
      filter: { value: 'page', property: 'object' },
      page_size: 1
    });

    const parentPageId = pageSearch.results?.[0]?.id;
    if (!parentPageId) return null;

    const createResp = await notionRequest('/databases', token, {
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

    if (createResp.id) {
      await saveNotionCredentials(token, createResp.id);
      return createResp.id;
    }

    return null;
  } catch {
    return null;
  }
}
