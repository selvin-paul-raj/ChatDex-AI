import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabase, getCorsHeaders } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cors = getCorsHeaders();

  if (req.method === 'OPTIONS') {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  // Set CORS headers for all responses
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { state } = req.query;

  if (!state || typeof state !== 'string') {
    return res.status(400).json({ error: 'Missing state parameter' });
  }

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('notion_tokens')
      .select('access_token, workspace_name')
      .eq('state', state)
      .single();

    if (error || !data) {
      return res.status(202).json({ pending: true });
    }

    // Delete the record after retrieval (one-time use)
    await supabase
      .from('notion_tokens')
      .delete()
      .eq('state', state);

    return res.status(200).json({
      access_token: data.access_token,
      workspace_name: data.workspace_name,
    });
  } catch (e) {
    console.error('Token retrieval error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
