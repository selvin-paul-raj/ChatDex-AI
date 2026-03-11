import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>ChatDex AI — Server</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>🤖</div>
          <h1 style={styles.title}>ChatDex AI</h1>
          <p style={styles.subtitle}>
            OAuth &amp; API server for the ChatDex AI Chrome extension.
          </p>
          <div style={styles.status}>
            <span style={styles.dot}></span>
            Server is running
          </div>
          <div style={styles.endpoints}>
            <p style={styles.endpointLabel}>Available endpoints:</p>
            <code style={styles.code}>/api/notion-callback</code>
            <code style={styles.code}>/api/notion-token</code>
            <code style={styles.code}>/oauth/consent</code>
          </div>
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
    fontSize: '48px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '24px',
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#16a34a',
    marginBottom: '24px',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#16a34a',
    display: 'inline-block',
  },
  endpoints: {
    background: '#f9fafb',
    border: '1px solid #e8e8e8',
    borderRadius: '10px',
    padding: '16px 20px',
    textAlign: 'left' as const,
  },
  endpointLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#999',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '10px',
  },
  code: {
    display: 'block',
    fontSize: '13px',
    color: '#2563eb',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    padding: '4px 0',
  },
};
