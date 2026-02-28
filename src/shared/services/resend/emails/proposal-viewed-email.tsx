import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { ROOTS } from '@/shared/config/roots'

const styles = {
  body: {
    backgroundColor: '#f6f9fc',
    fontFamily: '-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif',
    padding: '20px 0',
  },
  container: {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '32px',
    borderRadius: 8,
    maxWidth: '560px',
  },
  badge: {
    display: 'inline-block',
    backgroundColor: '#dcfce7',
    color: '#166534',
    padding: '4px 12px',
    borderRadius: 99,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 12,
    color: '#111',
  },
  text: {
    fontSize: 15,
    lineHeight: '24px',
    color: '#444',
    marginBottom: 12,
  },
  stat: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 15,
    fontWeight: 600,
    color: '#111',
  },
  button: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: 6,
    fontSize: 15,
    fontWeight: 600,
    textDecoration: 'none',
  },
  hr: {
    borderColor: '#e6ebf1',
    margin: '24px 0',
  },
  footer: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'center' as const,
    marginTop: 24,
  },
}

interface Props {
  customerName: string
  proposalLabel: string
  viewedAt: string
  sourceLabel: string
  proposalId: string
}

const base = ROOTS.generateUrl('', { absolute: true, isProduction: true })

export default function ProposalViewedEmail({
  customerName,
  proposalLabel,
  viewedAt,
  sourceLabel,
  proposalId,
}: Props) {
  const dashboardUrl = `${base}/proposal-flow/proposal/${proposalId}`
  const viewedDate = new Date(viewedAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <Html>
      <Head />
      <Preview>
        {customerName}
        {' '}
        just opened their proposal
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <div style={styles.badge}>🔔 Proposal Opened</div>

          <Heading style={styles.heading}>
            {customerName}
            {' '}
            opened their proposal
          </Heading>

          <Text style={styles.text}>
            A customer just viewed their proposal. Here are the details:
          </Text>

          <Section>
            <div style={styles.stat}>
              <p style={styles.statLabel}>Customer</p>
              <p style={styles.statValue}>{customerName}</p>
            </div>
            <div style={styles.stat}>
              <p style={styles.statLabel}>Proposal</p>
              <p style={styles.statValue}>{proposalLabel}</p>
            </div>
            <div style={styles.stat}>
              <p style={styles.statLabel}>Viewed At</p>
              <p style={styles.statValue}>{viewedDate}</p>
            </div>
            <div style={styles.stat}>
              <p style={styles.statLabel}>Source</p>
              <p style={styles.statValue}>{sourceLabel}</p>
            </div>
          </Section>

          <Hr style={styles.hr} />

          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={dashboardUrl} style={styles.button}>
              View Proposal in Dashboard
            </Button>
          </Section>

          <Text style={styles.footer}>
            Tri Pros Remodeling · Agent Notification
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

ProposalViewedEmail.PreviewProps = {
  customerName: 'Sean Yehuda',
  proposalLabel: 'Kitchen Remodel - Full Scope',
  viewedAt: new Date().toISOString(),
  sourceLabel: 'Opened from email link',
  proposalId: 'preview-id',
} satisfies Props
