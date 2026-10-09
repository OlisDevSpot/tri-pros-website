import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

export interface VisitCancellationEmailProps {
  firstName: string
  /** "Wed, Oct 7, 10:00 AM" */
  visitDayTime: string
  /** "(626) 555-0123" */
  mainLinePhone: string
  companyName: string
  logoUrl: string
}

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
    maxWidth: '600px',
  },
  heading: {
    fontSize: 26,
    fontWeight: 700,
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
    lineHeight: '24px',
    color: '#333',
    marginBottom: 16,
  },
  footer: {
    fontSize: 12,
    color: '#8898aa',
    textAlign: 'center' as const,
    marginTop: 24,
  },
}

export function VisitCancellationEmail(props: VisitCancellationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Your home visit on
        {' '}
        {props.visitDayTime}
        {' '}
        is cancelled
      </Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={{ textAlign: 'center', marginBottom: 24 }}>
            <Img src={props.logoUrl} width="140" alt={props.companyName} />
          </Section>

          <Heading style={styles.heading}>Your home visit is cancelled</Heading>

          <Text style={styles.text}>
            Hi
            {' '}
            {props.firstName}
            ,
          </Text>

          <Text style={styles.text}>
            Your visit on
            {' '}
            <strong>{props.visitDayTime}</strong>
            {' '}
            is cancelled, and the attached update removes it from your calendar.
          </Text>

          <Text style={styles.text}>
            Questions or want a new time? Call or text us at
            {' '}
            {props.mainLinePhone}
            .
          </Text>

          <Text style={styles.footer}>{props.companyName}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export function buildVisitCancellationText(props: VisitCancellationEmailProps): string {
  return [
    `Hi ${props.firstName},`,
    '',
    `Your visit on ${props.visitDayTime} is cancelled, and the attached update removes it from your calendar.`,
    `Questions or want a new time? Call or text us at ${props.mainLinePhone}.`,
    '',
    props.companyName,
  ].join('\n')
}
