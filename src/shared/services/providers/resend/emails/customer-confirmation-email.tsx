import {
  Body,
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
import { ROOTS } from '@/shared/config/roots'
import { emailStyles as s } from '@/shared/services/providers/resend/lib/email-styles'

const base = ROOTS.generateUrl('', { absolute: true })
const logoUrl = `${base}/company/logo/logo-light-right.jpg`

export interface CustomerConfirmationEmailProps {
  firstName: string
  smsConsent: boolean
  callConsent: boolean
  recapItems: { label: string, value: string }[]
}

export function CustomerConfirmationEmail({
  firstName,
  smsConsent,
  callConsent,
  recapItems,
}: CustomerConfirmationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Thanks
        {' '}
        {firstName}
        {' — '}
        we'll be in touch within 24 hours.
      </Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          <Section style={s.logoWrap}>
            <Img src={logoUrl} width="140" alt="Tri Pros Remodeling" />
          </Section>

          <Heading style={s.heading}>
            Thanks,
            {' '}
            {firstName}
            {' '}
            — we got your inquiry.
          </Heading>
          <Text style={s.text}>
            A member of the Tri Pros Remodeling team will review your project
            and reach out within
            {' '}
            <strong>24 hours</strong>
            . We appreciate you trusting us with your project.
          </Text>

          <Section style={s.card}>
            <Text style={s.sectionLabel}>What to expect</Text>

            <Section style={s.fieldRow}>
              <Text style={s.fieldLabel}>1 · Email confirmation</Text>
              <Text style={s.fieldValue}>
                This is it — you're confirmed in our system.
              </Text>
            </Section>

            <Section style={callConsent || smsConsent ? s.fieldRow : { ...s.fieldRow, borderBottom: 'none' }}>
              <Text style={s.fieldLabel}>2 · Call within 24 hours</Text>
              <Text style={s.fieldValue}>
                A team member will phone you to talk through scope, timing,
                and answer any questions.
                {!callConsent && ' (You can opt in to broader updates anytime.)'}
              </Text>
            </Section>

            {smsConsent && (
              <Section style={{ ...s.fieldRow, borderBottom: 'none' }}>
                <Text style={s.fieldLabel}>3 · SMS confirmation</Text>
                <Text style={s.fieldValue}>
                  Once a time is set, we'll text to confirm the appointment.
                  Reply STOP at any time to opt out.
                </Text>
              </Section>
            )}
          </Section>

          {recapItems.length > 0 && (
            <Section style={s.card}>
              <Text style={s.sectionLabel}>Your inquiry</Text>
              {recapItems.map((item, i) => (
                <Section
                  key={item.label}
                  style={i === recapItems.length - 1 ? { ...s.fieldRow, borderBottom: 'none' } : s.fieldRow}
                >
                  <Text style={s.fieldLabel}>{item.label}</Text>
                  <Text style={s.fieldValue}>{item.value}</Text>
                </Section>
              ))}
            </Section>
          )}

          <Hr style={s.hr} />

          <Text style={s.text}>
            Have a question in the meantime? Just reply to this email — it
            goes straight to our team.
          </Text>

          <Text style={s.text}>
            Talk soon,
            <br />
            <strong>The Tri Pros Remodeling team</strong>
            <br />
            <Link href="tel:8184707656" style={s.link}>(818) 470-7656</Link>
            {' · '}
            <Link href={`${base}`} style={s.link}>triprosremodeling.com</Link>
          </Text>

          <Hr style={s.hr} />

          <Text style={s.footer}>
            You're receiving this because you submitted an inquiry at
            {' '}
            <Link href={`${base}/contact`} style={s.link}>triprosremodeling.com/contact</Link>
            .
            <br />
            ©
            {' '}
            {new Date().getFullYear()}
            {' '}
            Tri Pros Remodeling, Inc. Southern California.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

CustomerConfirmationEmail.PreviewProps = {
  firstName: 'Sean',
  smsConsent: true,
  callConsent: true,
  recapItems: [
    { label: 'Project type', value: 'Energy-Efficient Construction' },
    { label: 'Preferred timeline', value: 'Within 3 months' },
    { label: 'Location', value: 'Encino, CA' },
    { label: 'Description', value: 'Whole-home energy retrofit including solar, insulation, smart HVAC, and replacement windows.' },
  ],
} satisfies CustomerConfirmationEmailProps
