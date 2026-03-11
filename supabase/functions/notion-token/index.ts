// Supabase Edge Function: notion-token
// Called by the extension to retrieve the OAuth token after authorization.
// Returns the token if found for the given state, then deletes the record.
// Uses Node.js npm imports (Supabase Edge Functions Node.js compat).

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const state = url.searchParams.get('state');

  if (!state) {
    return Response.json(
      { error: 'Missing state parameter' },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up token by state
    const { data, error } = await supabase
      .from('notion_tokens')
      .select('access_token, workspace_name')
      .eq('state', state)
      .single();

    if (error || !data) {
      return Response.json(
        { pending: true },
        { status: 202, headers: corsHeaders }
      );
    }

    // Delete the record after retrieval (one-time use)
    await supabase
      .from('notion_tokens')
      .delete()
      .eq('state', state);

    return Response.json(
      {
        access_token: data.access_token,
        workspace_name: data.workspace_name,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (e) {
    console.error('Token retrieval error:', e);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
});
