# ChatDex AI

> Capture, search, export, and sync your AI chats to Notion — right from ChatGPT & Gemini.

A Chrome Extension that indexes every prompt and AI response in real time, lets you search and navigate conversations, export as Markdown/JSON, and one-click sync to your own Notion database with clean study-notes formatting.

---

## Features

- **Real-Time Indexing** — Captures every prompt and AI response as you chat
- **Search & Navigate** — Filter prompts by keyword, click to scroll to any turn
- **Notion Sync** — Sync selected prompts or full conversations to Notion (code blocks, lists, headings, bold, italic, links)
- **Export** — Download as Markdown (.md) or JSON with full metadata
- **Multi-Platform** — ChatGPT and Gemini
- **Draggable Panel** — Collapsible dark sidebar, fully draggable, select-all controls
- **Study Notes Format** — Your question as a highlighted callout, AI answer as native Notion blocks

---

## Quick Start (3 Steps)

No setup needed — the backend is already hosted. Just clone, load, and go.

### 1. Clone

```bash
git clone https://github.com/selvin-paul-raj/ChatDex-AI.git
```

### 2. Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `ChatDex-AI/` folder inside the cloned repo

### 3. Connect Notion

1. Click the ChatDex AI extension icon → **Options**
2. Click **Login with Notion**
3. Authorize your Notion workspace
4. The extension auto-creates an **"AI Chats"** database in your Notion
5. Go to [chatgpt.com](https://chatgpt.com) or [gemini.google.com](https://gemini.google.com) and start syncing!

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
ChatDex-AI/                       # Load this folder in Chrome
├── manifest.json                 # Permissions, content scripts, service worker
├── config.js                     # Pre-configured (no editing needed)
├── background.js                 # Service worker — Notion API proxy, badge
├── content.js                    # Panel injection, indexing, MutationObserver
├── platformDetector.js           # Platform detection + CSS selectors
├── notionSync.js                 # Notion API — page creation, block formatting
├── exporter.js                   # Markdown / JSON export
├── utils.js                      # Utilities — extractText, debounce, storage
├── options.html/js/css           # Options page — Notion OAuth + settings
├── popup.html/js/css             # Popup — quick stats + export
├── panel.css                     # Dark sidebar theme
└── icons/                        # Extension icons (16, 48, 128)
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
