import Head from 'next/head';

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — ChatDex AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={styles.container}>
        <div style={styles.content}>
          <h1>Privacy Policy</h1>
          <p style={styles.updated}>Last updated: March 9, 2026</p>

          <h2>1. Introduction</h2>
          <p>
            ChatDex AI (&quot;we&quot;, &quot;our&quot;, &quot;the Extension&quot;) is a browser extension developed by
            GENXRVERSE. This Privacy Policy explains how we collect, use, and protect your information
            when you use our Chrome extension and associated services.
          </p>

          <h2>2. Information We Collect</h2>
          <p>We collect only the minimum information necessary to provide our services:</p>
          <ul>
            <li><strong>Notion OAuth Tokens:</strong> When you connect your Notion workspace, we temporarily
              process your OAuth authorization code to obtain an access token. Tokens are stored
              transiently on our server (deleted within 10 minutes or upon retrieval) and permanently
              in your browser&apos;s local storage.</li>
            <li><strong>Chat Data:</strong> The Extension reads AI chat conversations from supported platforms
              (ChatGPT, Claude, Gemini, Perplexity, Poe, Grok) only when you explicitly trigger
              an export or sync. This data is processed locally in your browser.</li>
            <li><strong>Workspace Name:</strong> We store the name of your connected Notion workspace
              for display purposes only.</li>
          </ul>

          <h2>3. How We Use Your Information</h2>
          <ul>
            <li>To authenticate your Notion account via OAuth 2.0</li>
            <li>To export and sync your AI chat conversations to your Notion workspace</li>
            <li>To organize and tag your conversations locally</li>
          </ul>

          <h2>4. Data Storage &amp; Security</h2>
          <ul>
            <li>All chat data is processed locally in your browser and is never stored on our servers.</li>
            <li>OAuth tokens are transmitted over HTTPS and stored transiently with automatic cleanup.</li>
            <li>We use Supabase with Row Level Security for temporary token storage.</li>
            <li>Your Notion access token is stored locally in your browser using Chrome&apos;s storage API.</li>
          </ul>

          <h2>5. Third-Party Services</h2>
          <p>We integrate with the following third-party services:</p>
          <ul>
            <li><strong>Notion API:</strong> To sync your conversations to your Notion workspace.</li>
            <li><strong>Supabase:</strong> For secure, temporary OAuth token exchange.</li>
            <li><strong>Vercel:</strong> For hosting our OAuth callback server.</li>
          </ul>

          <h2>6. Data Sharing</h2>
          <p>
            We do not sell, trade, or share your personal information with third parties.
            Data is only transmitted to Notion as explicitly directed by you.
          </p>

          <h2>7. Your Rights</h2>
          <ul>
            <li>You can disconnect your Notion account at any time from the Extension settings.</li>
            <li>You can uninstall the Extension to remove all locally stored data.</li>
            <li>You can revoke the integration&apos;s access from your Notion settings.</li>
          </ul>

          <h2>8. Contact</h2>
          <p>
            For privacy-related inquiries, contact us at{' '}
            <a href="mailto:selvinpaulraj@genxrverse.com">selvinpaulraj@genxrverse.com</a>.
          </p>

          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be posted on this page
            with an updated revision date.
          </p>
        </div>
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    maxWidth: '720px',
    margin: '0 auto',
    padding: '40px 20px',
    color: '#1a1a2e',
    lineHeight: 1.7,
  },
  content: {
    background: '#fff',
    border: '1px solid #e8e8e8',
    borderRadius: '12px',
    padding: '40px',
  },
  updated: {
    color: '#666',
    fontSize: '14px',
    marginBottom: '24px',
  },
};
