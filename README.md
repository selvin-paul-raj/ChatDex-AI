# ChatDex AI

> Capture, search, export, and sync your AI chats to Notion — right from ChatGPT & Gemini.

A Chrome Extension (Manifest V3) that indexes every prompt and AI response in real time, lets you search and navigate conversations, export as Markdown/JSON, and one-click sync to your own Notion database with clean study-notes formatting.

---

## Demo

| Panel on ChatGPT | Synced Notion Page |
|---|---|
| Dark sidebar with search, checkboxes, export buttons | Clean notes: your prompt as callout, AI response as native blocks |

---

## Features

- **Real-Time Indexing** — Captures every prompt and AI response as you chat via MutationObserver
- **Search & Navigate** — Filter prompts by keyword, click to scroll to any turn
- **Notion Sync** — Sync selected prompts or full conversations to your Notion with proper formatting (code blocks, lists, headings, bold, italic, links)
- **Export** — Download as Markdown (.md) or JSON with full metadata
- **Multi-Platform** — ChatGPT and Gemini with platform-specific themes
- **Draggable Panel** — Collapsible dark sidebar, fully draggable, select-all controls
- **Study Notes Format** — Notion pages formatted like clean study notes — your question as a highlighted callout, AI answer as native Notion blocks

---

## Quick Start (Use It in 5 Minutes)

### 1. Clone

```bash
git clone git@github.com:selvin-paul-raj/ChatDex-AI.git
cd ChatDex-AI
```

### 2. Set Up Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **New Integration**
3. Set type to **Public** (required for OAuth)
4. Fill in:
   - **Name**: ChatDex AI
   - **Redirect URI**: `https://YOUR_SERVER.vercel.app/api/notion-callback`
   - **Privacy Policy URL**: `https://YOUR_SERVER.vercel.app/privacy`
   - **Terms URL**: `https://YOUR_SERVER.vercel.app/terms`
5. Copy your **OAuth Client ID** and **OAuth Client Secret**

### 3. Set Up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run:

```sql
CREATE TABLE IF NOT EXISTS notion_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  state text UNIQUE NOT NULL,
  access_token text NOT NULL,
  workspace_name text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notion_tokens_state ON notion_tokens (state);
CREATE INDEX IF NOT EXISTS idx_notion_tokens_created ON notion_tokens (created_at);
ALTER TABLE notion_tokens ENABLE ROW LEVEL SECURITY;
```

3. Note your **Project URL** and **Anon Key** from Settings → API

### 4. Deploy Server to Vercel

```bash
cd server
npm install
```

Set these environment variables in [Vercel Dashboard](https://vercel.com) → Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |
| `NOTION_CLIENT_ID` | From step 2 |
| `NOTION_CLIENT_SECRET` | From step 2 |
| `NOTION_REDIRECT_URI` | `https://YOUR_SERVER.vercel.app/api/notion-callback` |

Then deploy:

```bash
npx vercel --prod
```

### 5. Configure the Extension

```bash
cd ai-chat-suite
cp config.example.js config.js
```

Edit `config.js`:

```js
const ACS_CONFIG = Object.freeze({
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SERVER_URL: 'https://YOUR_SERVER.vercel.app',
  NOTION_CLIENT_ID: 'your-notion-client-id',
  NOTION_REDIRECT_URI: 'https://YOUR_SERVER.vercel.app/api/notion-callback',
  NOTION_API_VERSION: '2022-06-28',
  OAUTH_POLL_INTERVAL: 2000,
  OAUTH_TIMEOUT: 300000,
});
```

### 6. Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `ai-chat-suite/` folder
4. Done! Go to ChatGPT or Gemini

### 7. Connect Notion

1. Click the ChatDex AI icon → **Options**
2. Click **Login with Notion**
3. Authorize your workspace
4. Extension auto-creates an **"AI Chats"** database in your Notion
5. Start syncing chats!

---

## How Notion Sync Looks

Your synced chats are formatted as clean study notes:

```
📝 Page: "How to use async/await in JavaScript"

┌─────────────────────────────────────────────┐
│ 💬  Explain async/await with examples        │  ← Your prompt (blue callout)
└─────────────────────────────────────────────┘

   ChatGPT Response                              ← Gray heading

   **async/await** is syntactic sugar over       ← Native paragraph with bold
   Promises that makes asynchronous code
   look synchronous.

   ### Basic Example                             ← Native heading

   ┌─ javascript ─────────────────────────┐
   │ async function fetchData() {          │     ← Native code block
   │   const res = await fetch('/api');    │
   │   return res.json();                  │
   │ }                                     │
   └──────────────────────────────────────┘

   - Cleaner than .then() chains                 ← Native bullet list
   - Easier error handling with try/catch

   ─────────────────────────────────────────     ← Divider between turns
```

Each page has database properties: **Name**, **Platform** (chatgpt/gemini), **Tags**, **Date**.

---

## Project Structure

```
ChatDex-AI/
├── ai-chat-suite/              # Chrome Extension (Manifest V3)
│   ├── manifest.json           # Permissions, content scripts, service worker
│   ├── config.example.js       # Config template (copy to config.js)
│   ├── background.js           # Service worker — Notion API proxy, badge
│   ├── content.js              # Panel injection, indexing, MutationObserver
│   ├── platformDetector.js     # Platform detection + CSS selectors
│   ├── notionSync.js           # Notion API — page creation, block formatting
│   ├── exporter.js             # Markdown / JSON export
│   ├── utils.js                # Utilities — extractText, debounce, storage
│   ├── options.html/js/css     # Options page — Notion OAuth + settings
│   ├── popup.html/js/css       # Popup — quick stats + export
│   ├── panel.css               # Dark sidebar theme
│   └── icons/                  # Extension icons (16, 48, 128)
│
├── server/                     # Vercel backend (Next.js)
│   ├── pages/api/
│   │   ├── notion-callback.ts  # OAuth callback → exchange code → store token
│   │   └── notion-token.ts     # Polling endpoint — extension fetches token
│   ├── pages/
│   │   ├── privacy.tsx         # Privacy policy page
│   │   └── terms.tsx           # Terms of service page
│   └── lib/supabase.ts         # Supabase client
│
└── supabase/                   # Database setup
    └── migrations/
        └── 001_notion_tokens.sql  # Token table migration
```

---

## How It Works

```
                  ┌──────────────┐
                  │   ChatGPT /  │
                  │   Gemini     │
                  └──────┬───────┘
                         │ Content Script
                         ▼
               ┌─────────────────────┐
               │  ChatDex AI Panel   │
               │  (index, search,    │
               │   select, export)   │
               └────────┬────────────┘
                        │ Sync
          ┌─────────────┼────────────────┐
          ▼             ▼                ▼
    ┌──────────┐  ┌───────────┐  ┌────────────┐
    │ Download │  │ Background│  │  Options   │
    │ MD/JSON  │  │  Worker   │  │  (OAuth)   │
    └──────────┘  │ (CORS     │  └─────┬──────┘
                  │  proxy)   │        │
                  └─────┬─────┘        ▼
                        │       ┌────────────┐
                        ▼       │  Vercel    │
                  ┌───────────┐ │  Server    │
                  │ Notion    │◄┤ (callback) │
                  │ API       │ └─────┬──────┘
                  └───────────┘       │
                                ┌─────▼──────┐
                                │  Supabase  │
                                │ (temp      │
                                │  tokens)   │
                                └────────────┘
```

1. **Content Script** injects panel on ChatGPT/Gemini, indexes messages via MutationObserver
2. **Background Worker** proxies Notion API calls to bypass CORS
3. **OAuth Flow**: Options page → Notion auth → Vercel callback → token stored in Supabase → extension polls and retrieves it
4. **Notion Sync**: Conversations converted to native Notion blocks and uploaded in chunks of 100

---

## Tech Stack

| Layer | Technology |
|---|---|
| Extension | Chrome Manifest V3, Vanilla JS, CSS |
| Backend | Next.js on Vercel (serverless) |
| Database | Supabase (PostgreSQL) — temporary OAuth tokens |
| Integration | Notion API (OAuth 2.0) |
| Styling | GitHub-inspired dark theme |

---

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m "Add your feature"`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT
