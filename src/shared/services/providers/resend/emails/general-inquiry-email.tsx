import type { inferInput } from '@trpc/tanstack-react-query'
import type { trpc } from '@/trpc/server'
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

type InputData = inferInput<typeof trpc.landingRouter.generalInquiry>

interface EmailTemplateProps {
  data: InputData
}

const base = ROOTS.generateUrl('', { absolute: true })
const logoUrl = `${base}/company/logo/logo-light-right.jpg`

export function GeneralInquiryEmail({ data }: EmailTemplateProps) {
  const addressParts = [
    data.address?.street,
    data.address?.city,
    data.address?.state,
    data.address?.zipCode,
  ].filter(Boolean)
  const fallbackAddress = addressParts.length > 0 ? addressParts.join(', ') : null
  const fullAddress = data.address?.fullAddress ?? fallbackAddress

  const preview = `New inquiry from ${data.name} — ${data.email}`

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          <Section style={s.logoWrap}>
            <Img src={logoUrl} width="140" alt="Tri Pros Remodeling" />
          </Section>

          <Text style={s.preheader}>New General Inquiry</Text>
          <Heading style={s.heading}>
            {data.name}
            {' '}
            wants to talk
          </Heading>
          <Text style={s.text}>
            Reply to this email to respond directly to
            {' '}
            <Link href={`mailto:${data.email}`} style={s.link}>{data.email}</Link>
            .
          </Text>

          <Section style={s.card}>
            <Text style={s.sectionLabel}>Contact</Text>
            <FieldRow label="Name" value={data.name} />
            <FieldRow
              label="Email"
              value={(
                <Link href={`mailto:${data.email}`} style={s.link}>
                  {data.email}
                </Link>
              )}
            />
            <FieldRow
              label="Phone"
              value={(
                <Link href={`tel:${data.phone}`} style={s.link}>
                  {data.phone}
                </Link>
              )}
              isLast={!fullAddress}
            />
            {fullAddress && (
              <FieldRow label="Address" value={fullAddress} isLast />
            )}
          </Section>

          <Section style={s.card}>
            <Text style={s.sectionLabel}>Inquiry</Text>
            <Text style={s.fieldValue}>{data.inquiryDescription}</Text>
          </Section>

          <Section style={s.card}>
            <Text style={s.sectionLabel}>Consent</Text>
            <ConsentRow label="SMS opt-in" granted={data.smsConsent} />
            <ConsentRow label="Call opt-in" granted={data.callConsent} isLast />
          </Section>

          <Hr style={s.hr} />

          <Text style={s.footer}>
            Sent from the
            {' '}
            <Link href={`${base}/contact`} style={s.link}>triprosremodeling.com/contact</Link>
            {' '}
            general-inquiry form.
            <br />
            ©
            {' '}
            {new Date().getFullYear()}
            {' '}
            Tri Pros Remodeling, Inc.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

function FieldRow({
  label,
  value,
  isLast = false,
}: {
  label: string
  value: React.ReactNode
  isLast?: boolean
}) {
  return (
    <Section style={isLast ? { ...s.fieldRow, borderBottom: 'none' } : s.fieldRow}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={s.fieldValue}>{value}</Text>
    </Section>
  )
}

function ConsentRow({
  label,
  granted,
  isLast = false,
}: {
  label: string
  granted: boolean
  isLast?: boolean
}) {
  return (
    <Section style={isLast ? { ...s.fieldRow, borderBottom: 'none' } : s.fieldRow}>
      <Text style={s.fieldLabel}>{label}</Text>
      <span style={granted ? s.badgeYes : s.badgeNo}>
        {granted ? 'Granted' : 'Not granted'}
      </span>
    </Section>
  )
}

GeneralInquiryEmail.PreviewProps = {
  data: {
    name: 'Sean Yehuda',
    email: 'sean@example.com',
    phone: '8185551234',
    inquiryDescription: 'Looking for a quote on a kitchen remodel and accessory dwelling unit (ADU) on a 1980 SFR in Encino. Budget is roughly $250k. Hoping to break ground in Q3.',
    address: {
      street: '15555 Ventura Blvd',
      city: 'Encino',
      state: 'CA',
      zipCode: '91436',
      fullAddress: '15555 Ventura Blvd, Encino, CA 91436',
    },
    smsConsent: true,
    callConsent: true,
  },
} satisfies EmailTemplateProps
