import Head from 'next/head';

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Use — ChatDex AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={styles.container}>
        <div style={styles.content}>
          <h1>Terms of Use</h1>
          <p style={styles.updated}>Last updated: March 9, 2026</p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By installing and using ChatDex AI (&quot;the Extension&quot;), developed by GENXRVERSE,
            you agree to be bound by these Terms of Use. If you do not agree, please uninstall
            the Extension.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            ChatDex AI is a Chrome browser extension that allows users to:
          </p>
          <ul>
            <li>Index and organize AI chat conversations from supported platforms</li>
            <li>Auto-tag conversations for easy retrieval</li>
            <li>Export conversations in multiple formats (Markdown, JSON, text)</li>
            <li>Sync conversations to Notion workspaces</li>
          </ul>

          <h2>3. User Responsibilities</h2>
          <ul>
            <li>You are responsible for maintaining the security of your Notion account credentials.</li>
            <li>You agree to use the Extension only for lawful purposes.</li>
            <li>You are responsible for any content you export or sync through the Extension.</li>
            <li>You must comply with the terms of service of the AI platforms you use.</li>
          </ul>

          <h2>4. Intellectual Property</h2>
          <p>
            The Extension, including its code, design, and documentation, is the intellectual property
            of GENXRVERSE. You are granted a limited, non-exclusive, non-transferable license to use
            the Extension for personal or commercial productivity purposes.
          </p>

          <h2>5. Notion Integration</h2>
          <p>
            The Extension integrates with Notion via their official API. By connecting your Notion
            workspace, you authorize the Extension to create and modify pages and databases in your
            workspace as directed by you. You can revoke this access at any time from your Notion
            integration settings.
          </p>

          <h2>6. Disclaimer of Warranties</h2>
          <p>
            The Extension is provided &quot;as is&quot; without warranties of any kind, express or implied.
            We do not guarantee uninterrupted or error-free operation. We are not responsible for
            any data loss resulting from the use of the Extension.
          </p>

          <h2>7. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, GENXRVERSE shall not be liable for any indirect,
            incidental, special, or consequential damages arising from the use of the Extension.
          </p>

          <h2>8. Modifications</h2>
          <p>
            We reserve the right to modify these Terms at any time. Continued use of the Extension
            after changes constitutes acceptance of the updated Terms.
          </p>

          <h2>9. Termination</h2>
          <p>
            You may stop using the Extension at any time by uninstalling it. We reserve the right
            to discontinue the Extension or restrict access at our discretion.
          </p>

          <h2>10. Contact</h2>
          <p>
            For questions about these Terms, contact us at{' '}
            <a href="mailto:selvinpaulraj@genxrverse.com">selvinpaulraj@genxrverse.com</a>.
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
