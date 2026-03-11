/**
 * ChatDex AI — Configuration
 *
 * SETUP:
 * 1. Copy this file:  cp config.example.js config.js
 * 2. Replace the placeholder values below with your actual credentials.
 * 3. Never commit config.js — it's in .gitignore.
 *
 * To obtain these values:
 *  - SUPABASE_URL        → Supabase project dashboard → Settings → API → Project URL
 *  - SERVER_URL           → Your deployed Vercel server URL (see /server)
 *  - NOTION_CLIENT_ID     → https://www.notion.so/my-integrations → Your integration → OAuth → Client ID
 *  - NOTION_REDIRECT_URI  → Must match the redirect URI registered in your Notion integration
 */
const ACS_CONFIG = Object.freeze({
  // Supabase project URL
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',

  // Vercel server URL (OAuth + API endpoints)
  SERVER_URL: 'https://YOUR_SERVER.vercel.app',

  // Notion OAuth public integration client ID
  NOTION_CLIENT_ID: 'YOUR_NOTION_CLIENT_ID',

  // Must match the redirect URI registered in your Notion integration
  NOTION_REDIRECT_URI: 'https://YOUR_SERVER.vercel.app/api/notion-callback',

  // Notion API version
  NOTION_API_VERSION: '2022-06-28',

  // How often to poll for OAuth token (ms)
  OAUTH_POLL_INTERVAL: 2000,

  // Max time to wait for OAuth completion (ms)
  OAUTH_TIMEOUT: 300000, // 5 minutes
});
