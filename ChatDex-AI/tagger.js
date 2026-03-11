/**
 * @fileoverview Auto-tagging engine for AI Chat Suite.
 * Categorizes prompts by keyword matching.
 */
console.log('[ACS] tagger.js loaded');

const TAG_RULES = [
  { tag: '💻 Coding',   color: '#4ade80', keywords: ['code', 'function', 'bug', 'error', 'javascript', 'python', 'api', 'debug', 'script', 'html', 'css', 'sql', 'react', 'node', 'typescript', 'class', 'variable', 'compile', 'runtime', 'stack'] },
  { tag: '✍️ Writing',  color: '#60a5fa', keywords: ['write', 'essay', 'email', 'blog', 'story', 'draft', 'edit', 'grammar', 'poem', 'letter', 'article', 'paragraph', 'rewrite', 'proofread', 'tone'] },
  { tag: '📚 Learning', color: '#f59e0b', keywords: ['explain', 'what is', 'how does', 'teach', 'understand', 'summarize', 'meaning', 'define', 'tutorial', 'example', 'concept', 'learn', 'difference between'] },
  { tag: '🔍 Research', color: '#a78bfa', keywords: ['research', 'compare', 'analyze', 'pros', 'cons', 'difference', 'versus', 'review', 'evaluate', 'assessment', 'findings', 'study'] },
  { tag: '🎨 Creative', color: '#f472b6', keywords: ['create', 'design', 'image', 'generate', 'art', 'music', 'idea', 'brainstorm', 'creative', 'logo', 'illustration', 'concept art'] },
  { tag: '📊 Data',     color: '#34d399', keywords: ['data', 'chart', 'excel', 'spreadsheet', 'csv', 'statistics', 'graph', 'table', 'dashboard', 'metric', 'visualization', 'dataset'] },
  { tag: '🤖 AI/ML',    color: '#fb923c', keywords: ['model', 'training', 'neural', 'llm', 'prompt', 'fine-tune', 'embedding', 'gpt', 'transformer', 'machine learning', 'deep learning', 'inference'] }
];

const DEFAULT_TAG = { tag: '💬 General', color: '#94a3b8' };

/**
 * Strips code blocks from text for cleaner keyword matching.
 * @param {string} text - Input text.
 * @returns {string}
 */
function stripCodeBlocks(text) {
  return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');
}

/**
 * Scores a text against all tag rules.
 * @param {string} text - Text to classify.
 * @returns {Array<{tag: string, color: string, score: number}>}
 */
function scoreText(text) {
  const lower = stripCodeBlocks(text).toLowerCase();
  return TAG_RULES.map(rule => {
    const score = rule.keywords.reduce((sum, kw) => {
      const regex = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      const matches = lower.match(regex);
      return sum + (matches ? matches.length : 0);
    }, 0);
    return { tag: rule.tag, color: rule.color, score };
  });
}

/**
 * Tags a prompt text. Returns one or more tags.
 * @param {string} promptText - User prompt text.
 * @param {string} [aiResponseText=''] - Optional AI response for improved accuracy.
 * @returns {Array<{tag: string, color: string}>}
 */
function tagPrompt(promptText, aiResponseText = '') {
  if (!promptText || promptText.trim().split(/\s+/).length < 5) {
    return [DEFAULT_TAG];
  }

  const combined = promptText + ' ' + aiResponseText;
  const scores = scoreText(combined);
  const maxScore = Math.max(...scores.map(s => s.score));

  if (maxScore === 0) return [DEFAULT_TAG];

  const topTags = scores
    .filter(s => s.score === maxScore)
    .map(s => ({ tag: s.tag, color: s.color }));

  return topTags;
}

/**
 * Returns all available tag rules for UI rendering.
 * @returns {Array<{tag: string, color: string}>}
 */
function getAllTags() {
  return [...TAG_RULES.map(r => ({ tag: r.tag, color: r.color })), DEFAULT_TAG];
}
