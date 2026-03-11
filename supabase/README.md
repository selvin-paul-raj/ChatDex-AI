# ChatDex AI — Supabase Setup

This folder contains the Supabase backend for Notion OAuth integration.

## Setup Instructions

### 1. Create a Notion Public Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **"New Integration"**
3. Set the type to **Public** (not Internal)
4. Under **OAuth Domain & URIs**, add your redirect URI:
   ```
   https://YOUR_PROJECT.supabase.co/functions/v1/notion-callback
   ```
5. Copy the **OAuth client ID** and **OAuth client secret**

### 2. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your Project URL (e.g. `https://YOUR_PROJECT.supabase.co`)

### 3. Run the Migration

In Supabase Dashboard → SQL Editor, run the contents of:
```
migrations/001_notion_tokens.sql
```

### 4. Set Environment Variables

In Supabase Dashboard → Edge Functions → Secrets, add:

| Secret Name | Value |
|---|---|
| `NOTION_CLIENT_ID` | Your Notion OAuth Client ID |
| `NOTION_CLIENT_SECRET` | Your Notion OAuth Client Secret |
| `NOTION_REDIRECT_URI` | `https://YOUR_PROJECT.supabase.co/functions/v1/notion-callback` |

> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in edge functions.

### 5. Deploy Edge Functions

```bash
supabase functions deploy notion-callback
supabase functions deploy notion-token
```

### 6. Update Extension Config

Copy `ai-chat-suite/config.example.js` to `config.js` and fill in your values:
```js
SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
NOTION_CLIENT_ID: 'your-notion-client-id',
NOTION_REDIRECT_URI: 'https://YOUR_PROJECT.supabase.co/functions/v1/notion-callback',
```

## Architecture

```
User clicks "Login with Notion"
  → Opens Notion OAuth page
  → User authorizes
  → Notion redirects to /notion-callback with code
  → Edge function exchanges code for access_token (server-side, using client_secret)
  → Stores token in notion_tokens table (keyed by state)
  → Shows "Connected!" success page
  → Extension polls /notion-token?state=xxx
  → Retrieves token, deletes from DB
  → Extension saves token locally, auto-creates "AI Chats" database
```
