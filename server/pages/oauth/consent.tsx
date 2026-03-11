import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';

export default function OAuthConsent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Supabase OAuth Server passes these query params
  const { client_id, redirect_uri, response_type, state, scope } = router.query;

  function handleAllow() {
    if (!redirect_uri || typeof redirect_uri !== 'string') return;
    setLoading(true);
    const url = new URL(redirect_uri);
    if (state) url.searchParams.set('state', state as string);
    url.searchParams.set('code', 'approved');
    window.location.href = url.toString();
  }

  function handleDeny() {
    if (!redirect_uri || typeof redirect_uri !== 'string') return;
    const url = new URL(redirect_uri);
    url.searchParams.set('error', 'access_denied');
    if (state) url.searchParams.set('state', state as string);
    window.location.href = url.toString();
  }

  return (
    <>
      <Head>
        <title>ChatDex AI — Authorize</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>🤖</span>
          </div>
          <h1 style={styles.title}>Authorize ChatDex AI</h1>
          <p style={styles.subtitle}>
            An application is requesting access to your account.
          </p>

          <div style={styles.scopeBox}>
            <p style={styles.scopeLabel}>This will allow the app to:</p>
            <ul style={styles.scopeList}>
              <li>Read and sync your AI chat conversations</li>
              <li>Export conversations to Notion</li>
              <li>Manage your connected workspace</li>
            </ul>
          </div>

          <div style={styles.buttons}>
            <button
              onClick={handleAllow}
              disabled={loading || !redirect_uri}
              style={{
                ...styles.btn,
                ...styles.btnAllow,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Redirecting...' : 'Allow'}
            </button>
            <button
              onClick={handleDeny}
              disabled={loading || !redirect_uri}
              style={{ ...styles.btn, ...styles.btnDeny }}
            >
              Deny
            </button>
          </div>

          <p style={styles.hint}>
            You will be redirected back to the application.
          </p>
        </div>
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#f5f5f5',
    padding: '20px',
    margin: 0,
  },
  card: {
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '16px',
    padding: '48px 40px',
    maxWidth: '440px',
    width: '100%',
    textAlign: 'center' as const,
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  },
  logo: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: '#eff6ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
    fontSize: '36px',
  },
  logoIcon: {},
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '24px',
  },
  scopeBox: {
    background: '#f9fafb',
    border: '1px solid #e8e8e8',
    borderRadius: '10px',
    padding: '16px 20px',
    marginBottom: '28px',
    textAlign: 'left' as const,
  },
  scopeLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#333',
    marginBottom: '10px',
  },
  scopeList: {
    fontSize: '13px',
    color: '#555',
    margin: 0,
    paddingLeft: '18px',
    lineHeight: '1.8',
  },
  buttons: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  btn: {
    flex: 1,
    padding: '12px 0',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  btnAllow: {
    background: '#2563eb',
    color: '#fff',
  },
  btnDeny: {
    background: '#f3f4f6',
    color: '#333',
    border: '1px solid #d1d5db',
  },
  hint: {
    fontSize: '12px',
    color: '#999',
  },
};
