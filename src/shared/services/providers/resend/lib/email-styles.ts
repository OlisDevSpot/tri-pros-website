// Inline email styles — email clients ignore <style> tags, so every rule
// must travel with the element. Shared across all Tri Pros email templates.

export const emailStyles = {
  body: {
    backgroundColor: '#f6f9fc',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif',
    padding: '20px 0',
    margin: 0,
  },

  container: {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '32px',
    borderRadius: 8,
    maxWidth: '600px',
  },

  logoWrap: {
    textAlign: 'center' as const,
    marginBottom: 24,
  },

  preheader: {
    fontSize: 12,
    color: '#8898aa',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    fontWeight: 600,
    marginBottom: 8,
  },

  heading: {
    fontSize: 24,
    fontWeight: 700,
    color: '#0f172a',
    marginTop: 0,
    marginBottom: 16,
    lineHeight: '32px',
  },

  text: {
    fontSize: 15,
    lineHeight: '22px',
    color: '#334155',
    marginTop: 0,
    marginBottom: 12,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginTop: 0,
    marginBottom: 12,
  },

  card: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '20px 24px',
    marginBottom: 16,
  },

  // Key/value row inside a card. Use as a table-row to survive most email clients.
  fieldRow: {
    paddingTop: 8,
    paddingBottom: 8,
    borderBottom: '1px solid #eef2f7',
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    marginTop: 0,
    marginBottom: 4,
  },

  fieldValue: {
    fontSize: 15,
    lineHeight: '22px',
    color: '#0f172a',
    margin: 0,
    wordBreak: 'break-word' as const,
  },

  badgeRow: {
    display: 'flex',
    gap: '8px',
    marginTop: 8,
  },

  badgeYes: {
    display: 'inline-block',
    backgroundColor: '#dcfce7',
    color: '#15803d',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid #bbf7d0',
  },

  badgeNo: {
    display: 'inline-block',
    backgroundColor: '#f1f5f9',
    color: '#64748b',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid #e2e8f0',
  },

  hr: {
    borderColor: '#e6ebf1',
    borderStyle: 'solid' as const,
    borderTopWidth: 1,
    borderBottomWidth: 0,
    margin: '24px 0',
  },

  footer: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center' as const,
    marginTop: 16,
    lineHeight: '18px',
  },

  link: {
    color: '#2563eb',
    textDecoration: 'none',
  },
} as const
