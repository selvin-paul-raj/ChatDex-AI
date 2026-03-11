-- Supabase migration: create notion_tokens table for OAuth flow
-- This table temporarily stores Notion access tokens during the OAuth handshake.
-- Tokens are deleted after retrieval by the extension, and auto-cleaned after 10 min.

CREATE TABLE IF NOT EXISTS notion_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  state text UNIQUE NOT NULL,
  access_token text NOT NULL,
  workspace_name text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Index for fast state lookups
CREATE INDEX IF NOT EXISTS idx_notion_tokens_state ON notion_tokens (state);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_notion_tokens_created ON notion_tokens (created_at);

-- Row Level Security: only service role (edge functions) can access
ALTER TABLE notion_tokens ENABLE ROW LEVEL SECURITY;

-- No public policies — only service_role key (used by edge functions) can read/write.
-- This ensures the tokens table is not accessible via the anon key or client-side.
