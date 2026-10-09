import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

export interface VisitSummaryEmailProps {
  firstName: string
  /** Null when no specialist is assigned yet. */
  specialistName: string | null
  /** Null when the company itself sets the visit. */
  coordinatorName: string | null
  /** "Wed, Oct 7, 10:00 AM" */
  visitDayTime: string
  /** "10:00 and 10:30 AM" */
  arrivalWindow: string
  addressLine1: string
  addressLine2: string
  visitUrl: string
  googleCalendarUrl: string
  coordinatorNote: string | null
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
  subtle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center' as const,
  },
  noteSection: {
    backgroundColor: '#f0f7ff',
    borderLeft: '3px solid #2563eb',
    padding: '12px 16px',
    borderRadius: 4,
    marginBottom: 16,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#2563eb',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 16,
    lineHeight: '24px',
    color: '#333',
    margin: 0,
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
  footer: {
    fontSize: 12,
    color: '#8898aa',
    textAlign: 'center' as const,
    marginTop: 24,
  },
}

function specialistOrFallback(specialistName: string | null): string {
  return specialistName ?? 'Your specialist'
}

function noteLabel(coordinatorName: string | null): string {
  return `A note from ${coordinatorName ?? 'our team'}`
}

export function VisitSummaryEmail(props: VisitSummaryEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Your home visit is booked for
        {' '}
        {props.visitDayTime}
      </Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={{ textAlign: 'center', marginBottom: 24 }}>
            <Img src={props.logoUrl} width="140" alt={props.companyName} />
          </Section>

          <Heading style={styles.heading}>Your home visit is booked</Heading>

          <Text style={styles.text}>
            Hi
            {' '}
            {props.firstName}
            ,
          </Text>

          <Text style={styles.text}>
            {specialistOrFallback(props.specialistName)}
            {' '}
            from
            {' '}
            {props.companyName}
            {' '}
            will see you on
            {' '}
            <strong>{props.visitDayTime}</strong>
            , arriving between
            {' '}
            {props.arrivalWindow}
            .
          </Text>

          {(props.addressLine1 || props.addressLine2) && (
            <Text style={styles.text}>
              {props.addressLine1}
              {props.addressLine1 && props.addressLine2 && <br />}
              {props.addressLine2}
            </Text>
          )}

          {props.coordinatorNote && (
            <Section style={styles.noteSection}>
              <Text style={styles.noteLabel}>{noteLabel(props.coordinatorName)}</Text>
              <Text style={styles.noteText}>{props.coordinatorNote}</Text>
            </Section>
          )}

          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={props.visitUrl} style={styles.button}>
              See your visit details
            </Button>
          </Section>

          <Text style={styles.subtle}>
            The attached invite adds the visit to your calendar, or
            {' '}
            <Link href={props.googleCalendarUrl}>add it to Google Calendar</Link>
            .
          </Text>

          <Hr style={styles.hr} />

          <Text style={styles.text}>
            We kindly request that everyone needed to make this decision is present during our meeting.
            Want to keep your partner in the loop? Forward this email or share your visit link.
          </Text>

          <Text style={styles.text}>
            Need to change the time? Call or text us at
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

/** The plain-text part, so a text-only client and the spam filters see the same message. */
export function buildVisitSummaryText(props: VisitSummaryEmailProps): string {
  return [
    `Hi ${props.firstName},`,
    '',
    `${specialistOrFallback(props.specialistName)} from ${props.companyName} will see you on ${props.visitDayTime}, arriving between ${props.arrivalWindow}.`,
    [props.addressLine1, props.addressLine2].filter(Boolean).join('\n'),
    ...(props.coordinatorNote ? ['', `${noteLabel(props.coordinatorName)}: ${props.coordinatorNote}`] : []),
    '',
    `Your visit details: ${props.visitUrl}`,
    `Add to Google Calendar: ${props.googleCalendarUrl}`,
    '',
    'We kindly request that everyone needed to make this decision is present during our meeting.',
    `Need to change the time? Call or text us at ${props.mainLinePhone}.`,
    '',
    props.companyName,
  ].join('\n')
}
