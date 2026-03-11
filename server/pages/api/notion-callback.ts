import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabase, NOTION_TOKEN_URL, getCorsHeaders } from '../../lib/supabase';

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
<body><div class="card"><div class="icon">&#10003;</div><h1>Connected to Notion!</h1><p>Workspace: <span class="ws">${safe}</span></p><p class="hint">You can close this tab and return to the extension.</p></div></body></html>`;
}

function errorPage(message: string): string {
  const safe = escapeHtml(message);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ChatDex AI — Error</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fafafa;color:#1a1a2e}.card{text-align:center;background:#fff;border:1px solid #e8e8e8;border-radius:16px;padding:48px 40px;max-width:420px}.icon{width:64px;height:64px;border-radius:50%;background:#fee2e2;color:#ef4444;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:32px;font-weight:700}h1{font-size:22px;margin-bottom:8px}p{color:#666;font-size:14px}</style></head>
<body><div class="card"><div class="icon">&#10007;</div><h1>Authorization Failed</h1><p>${safe}</p></div></body></html>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cors = getCorsHeaders();

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    return res.end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state } = req.query;

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(errorPage('Missing authorization code or state.'));
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(errorPage('Server misconfigured. Missing Notion OAuth env vars.'));
  }

  try {
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
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(errorPage('Notion authorization failed. Please try again.'));
    }

    const tokenData = await tokenResp.json();
    const accessToken = tokenData.access_token;
    const workspaceName = tokenData.workspace_name || 'Notion Workspace';

    if (!accessToken) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(errorPage('No access token received from Notion.'));
    }

    const supabase = getSupabase();

    // Clean up expired tokens (older than 10 minutes)
    await supabase
      .from('notion_tokens')
      .delete()
      .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    // Upsert token
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
      res.setHeader('Content-Type', 'text/html');
      return res.status(500).send(errorPage('Failed to store authorization. Please try again.'));
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(successPage(workspaceName));
  } catch (e) {
    console.error('Callback error:', e);
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(errorPage('An unexpected error occurred.'));
  }
}
