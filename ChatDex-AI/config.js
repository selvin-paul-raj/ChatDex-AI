/**
 * ChatDex AI — Configuration
 *
 * These are public-facing values (no secrets).
 * The Notion Client Secret is only stored server-side on Vercel.
 *
 * To self-host with your own backend, replace these values.
 * Otherwise, the defaults work out of the box with the hosted backend.
 */
const ACS_CONFIG = Object.freeze({
  // Supabase project URL
  SUPABASE_URL: 'https://liuxfnoqpmbjzjqsllzo.supabase.co',

  // Vercel server URL (OAuth + API endpoints)
  SERVER_URL: 'https://server-ochre-nine-97.vercel.app',

  // Notion OAuth public integration client ID
  NOTION_CLIENT_ID: '31ed872b-594c-8173-b0f6-0037969e5711',

  // Must match the redirect URI registered in your Notion integration
  NOTION_REDIRECT_URI: 'https://server-ochre-nine-97.vercel.app/api/notion-callback',

  // Notion API version
  NOTION_API_VERSION: '2022-06-28',

  // How often to poll for OAuth token (ms)
  OAUTH_POLL_INTERVAL: 2000,

  // Max time to wait for OAuth completion (ms)
  OAUTH_TIMEOUT: 300000, // 5 minutes
});
