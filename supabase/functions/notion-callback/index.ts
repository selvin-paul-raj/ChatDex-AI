// Supabase Edge Function: notion-callback
// Handles the OAuth redirect from Notion, exchanges code for access_token,
// stores it temporarily, and shows a success page.
// Uses Node.js npm imports (Supabase Edge Functions Node.js compat).

import { createClient } from 'npm:@supabase/supabase-js@2';

const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;',
  };
  return str.replace(/[<>&"']/g, (c) => map[c] || c);
}

function successPage(workspaceName: string): string {
  const safe = escapeHtml(workspaceName);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ChatDex AI — Connected</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fafafa;color:#1a1a2e}.card{text-align:center;background:#fff;border:1px solid #e8e8e8;border-radius:16px;padding:48px 40px;max-width:420px}.icon{width:64px;height:64px;border-radius:50%;background:#dcfce7;color:#16a34a;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:32px;font-weight:700}h1{font-size:22px;margin-bottom:8px}p{color:#666;font-size:14px;margin-bottom:4px}.ws{font-weight:600;color:#1a1a2e}.hint{margin-top:20px;font-size:13px;color:#999}</style></head>
<body><div class="card"><div class="icon">✓</div><h1>Connected to Notion!</h1><p>Workspace: <span class="ws">${safe}</span></p><p class="hint">You can close this tab and return to the extension.</p></div></body></html>`;
}

function errorPage(message: string): string {
  const safe = escapeHtml(message);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ChatDex AI — Error</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fafafa;color:#1a1a2e}.card{text-align:center;background:#fff;border:1px solid #e8e8e8;border-radius:16px;padding:48px 40px;max-width:420px}.icon{width:64px;height:64px;border-radius:50%;background:#fee2e2;color:#ef4444;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:32px;font-weight:700}h1{font-size:22px;margin-bottom:8px}p{color:#666;font-size:14px}</style></head>
<body><div class="card"><div class="icon">✗</div><h1>Authorization Failed</h1><p>${safe}</p></div></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return new Response(errorPage('Missing authorization code or state.'), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return new Response(errorPage('Server misconfigured. Missing Notion OAuth env vars.'), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });
  }

  try {
    // Exchange authorization code for access token (server-side only)
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenResp = await fetch(NOTION_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResp.ok) {
      const err = await tokenResp.text();
      console.error('Notion token exchange failed:', err);
      return new Response(errorPage('Notion authorization failed. Please try again.'), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }

    const tokenData = await tokenResp.json();
    const accessToken = tokenData.access_token;
    const workspaceName = tokenData.workspace_name || 'Notion Workspace';

    if (!accessToken) {
      return new Response(errorPage('No access token received from Notion.'), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }

    // Store token in Supabase (service role — server-side only)
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Clean up expired tokens (older than 10 minutes)
    await supabase
      .from('notion_tokens')
      .delete()
      .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    // Insert new token (upsert on state conflict)
    const { error: insertError } = await supabase
      .from('notion_tokens')
      .upsert({
        state,
        access_token: accessToken,
        workspace_name: workspaceName,
        created_at: new Date().toISOString(),
      }, { onConflict: 'state' });

    if (insertError) {
      console.error('DB insert error:', insertError);
      return new Response(errorPage('Failed to store authorization. Please try again.'), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }

    return new Response(successPage(workspaceName), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });
  } catch (e) {
    console.error('Callback error:', e);
    return new Response(errorPage('An unexpected error occurred.'), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });
  }
});
