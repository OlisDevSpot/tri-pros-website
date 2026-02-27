import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { ROOTS } from '@/shared/config/roots'

const styles = {
  body: {
    backgroundColor: '#f6f9fc',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif',
    padding: '20px 0',
  },

  container: {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '32px',
    borderRadius: 8,
    maxWidth: '600px',
  },

  heading: {
    fontSize: 26,
    fontWeight: 700,
    textAlign: 'center' as const,
    marginBottom: 16,
  },

  sectionHeading: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 8,
  },

  text: {
    fontSize: 16,
    lineHeight: '24px',
    color: '#333',
    marginBottom: 16,
  },

  subtle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center' as const,
  },

  button: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    padding: '14px 28px',
    borderRadius: 6,
    fontSize: 16,
    fontWeight: 600,
    textDecoration: 'none',
  },

  hr: {
    borderColor: '#e6ebf1',
    margin: '24px 0',
  },

  signature: {
    fontSize: 16,
    lineHeight: '24px',
  },

  footer: {
    fontSize: 12,
    color: '#8898aa',
    textAlign: 'center' as const,
    marginTop: 24,
  },
}

interface Props {
  proposalUrl: string
  companyName?: string
  customerName: string
  repName?: string
  repPhone?: string
  heroImageUrl?: string
  logoUrl?: string
  projectSummary?: string
}

const base = ROOTS.generateUrl('', { absolute: true })

export default function ProposalEmail({
  proposalUrl,
  companyName = 'Tri Pros Remodeling',
  customerName,
  repName = 'TPR Office',
  repPhone = '8184707656',
  heroImageUrl = `${base}/hero-photos/modern-house-5.jpg`,
  logoUrl = `${base}/company/logo/logo-light-right.jpg`,
  projectSummary = 'We’ve prepared a customized proposal outlining the scope, pricing, and next steps for the scope of work we discussed.',
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your project proposal is ready</Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>
          {logoUrl && (
            <Section style={{ textAlign: 'center', marginBottom: 24 }}>
              <Img src={logoUrl} width="140" alt={companyName} />
            </Section>
          )}

          <Heading style={styles.heading}>
            Your Proposal Is Ready
          </Heading>

          <Text style={styles.text}>
            Hi
            {' '}
            {customerName.split(' ')[0]}
            ,
          </Text>

          <Text style={styles.text}>
            We’re excited to share your personalized proposal from
            {' '}
            <strong>{companyName}</strong>
            .
          </Text>

          <Text style={styles.text}>{projectSummary}</Text>

          <Section style={{ margin: '24px 0', textAlign: 'center' }}>
            <Img
              src={heroImageUrl}
              width="520"
              style={{ borderRadius: 8 }}
              alt="Project preview"
            />
          </Section>

          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={proposalUrl} style={styles.button}>
              View My Proposal
            </Button>
          </Section>

          <Text style={styles.subtle}>
            You’ll be able to review details, pricing options, and next steps.
          </Text>

          <Hr style={styles.hr} />

          <Section>
            <Heading as="h3" style={styles.sectionHeading}>
              What Happens Next?
            </Heading>

            <Text style={styles.text}>
              • Review your proposal at your convenience
              • Select any options you’d like included
              • Approve electronically when you’re ready
            </Text>
          </Section>

          <Hr style={styles.hr} />

          <Section>
            <Text style={styles.text}>
              If you have any questions, just reply to this email or contact me
              directly.
            </Text>

            <Text style={styles.signature}>
              {repName}
              <br />
              {companyName}
              {repPhone && (
                <>
                  <br />
                  {repPhone}
                </>
              )}
            </Text>
          </Section>

          <Text style={styles.footer}>
            ©
            {' '}
            {new Date().getFullYear()}
            {' '}
            {companyName}
            . All rights reserved.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

ProposalEmail.PreviewProps = {
  customerName: 'Sean Yehuda',
  proposalUrl: '#',
  repName: 'Oliver Porat',
} satisfies Props
