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
import { publicUrl } from '@/shared/config/public-url'
import { formatPhone, toDialString } from '@/shared/lib/phone'
import { emailStyles as s } from '@/shared/services/providers/resend/lib/email-styles'
import { formatProjectType } from '@/shared/services/providers/resend/lib/format-project-type'

type InputData = inferInput<typeof trpc.landingRouter.scheduleConsultation>

interface EmailTemplateProps {
  data: InputData
}

const base = publicUrl()
const logoUrl = `${base}/company/logo/logo-light-right.jpg`

export function ProjectEmailTemplate({ data }: EmailTemplateProps) {
  const preview = `New consultation request from ${data.name} — ${formatProjectType(data.projectType)}`

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          <Section style={s.logoWrap}>
            <Img src={logoUrl} width="140" alt="Tri Pros Remodeling" />
          </Section>

          <Text style={s.preheader}>New Consultation Request</Text>
          <Heading style={s.heading}>
            {data.name}
            {' '}
            wants a consultation
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
                <Link href={`tel:${toDialString(data.phone)}`} style={s.link}>
                  {formatPhone(data.phone)}
                </Link>
              )}
              isLast
            />
          </Section>

          <Section style={s.card}>
            <Text style={s.sectionLabel}>Project</Text>
            <FieldRow
              label="Project type"
              value={formatProjectType(data.projectType)}
            />
            {data.timeline && (
              <FieldRow label="Preferred timeline" value={data.timeline} />
            )}
            {data.propertyType && (
              <FieldRow label="Property type" value={data.propertyType} />
            )}
            {data.propertySize && (
              <FieldRow label="Property size" value={data.propertySize} />
            )}
            {data.location && (
              <FieldRow label="Location" value={data.location} />
            )}
            {data.budget && (
              <FieldRow
                label="Budget"
                value={data.budget}
                isLast={!data.projectDescription}
              />
            )}
            {data.projectDescription && (
              <FieldRow
                label="Description"
                value={data.projectDescription}
                isLast
              />
            )}
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
            schedule-consultation form.
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

ProjectEmailTemplate.PreviewProps = {
  data: {
    name: 'Sean Yehuda',
    email: 'sean@example.com',
    phone: '8185551234',
    projectType: 'energy-efficient-construction',
    timeline: 'within-3-months',
    budget: '$250k - $500k',
    propertyType: 'Single-family residence',
    propertySize: '2,800 sqft',
    location: 'Encino, CA',
    projectDescription: 'Whole-home energy retrofit including solar, insulation, smart HVAC, and replacement windows. ~1980 build.',
    smsConsent: true,
    callConsent: false,
  },
} satisfies EmailTemplateProps
