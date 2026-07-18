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
import { publicUrl } from '@/shared/config/public-url'
import { emailStyles } from '@/shared/services/providers/resend/lib/email-styles'

const buttonStyle = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: 6,
  fontSize: 15,
  fontWeight: 600,
  textDecoration: 'none',
}

interface Props {
  customerName: string
  proposalLabel: string
  proposalId: string
}

const base = publicUrl()

/**
 * Agent-facing notification: the homeowner clicked "Request Agreement" on
 * their proposal review page. This is a SIGNAL, not a lifecycle event — the
 * homeowner never touches the contract lifecycle; the agent prepares and
 * sends the signing draft manually.
 * see `src/shared/entities/proposals/DOCS.md#proposal-lock-ladder`
 */
export default function MoveForwardRequestEmail({ customerName, proposalLabel, proposalId }: Props) {
  const dashboardUrl = `${base}/proposal-flow/proposal/${proposalId}`

  return (
    <Html>
      <Head />
      <Preview>
        {customerName}
        {' '}
        is ready to move forward
      </Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Heading style={emailStyles.heading}>
            {customerName}
            {' '}
            is ready to move forward
          </Heading>
          <Text style={emailStyles.text}>
            The homeowner just requested their agreement from the proposal review page
            {proposalLabel ? ` for “${proposalLabel}”` : ''}
            . Review the proposal, then prepare and send the signing envelope when ready.
          </Text>
          <Section>
            <Button href={dashboardUrl} style={buttonStyle}>
              Open Proposal
            </Button>
          </Section>
          <Hr style={emailStyles.hr} />
          <Text style={emailStyles.footer}>
            Tri Pros Remodeling — internal notification
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
