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

interface NewLeadEmailProps {
  name: string
  phone: string | null
  city: string | null
  zip: string | null
  source: string
  dashboardUrl: string
}

const base = publicUrl()
const logoUrl = `${base}/company/logo/logo-light-right.jpg`

export function NewLeadEmail({ name, phone, city, zip, source, dashboardUrl }: NewLeadEmailProps) {
  const locationLabel = [city, zip].filter(Boolean).join(' ')
  const preview = `New lead: ${name} — ${source}`

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          <Section style={s.logoWrap}>
            <Img src={logoUrl} width="140" alt="Tri Pros Remodeling" />
          </Section>

          <Text style={s.preheader}>New Lead</Text>
          <Heading style={s.heading}>
            {name}
            {' '}
            just submitted their info
          </Heading>

          <Section style={s.card}>
            <Text style={s.sectionLabel}>Lead</Text>
            <FieldRow label="Name" value={name} />
            {phone && (
              <FieldRow
                label="Phone"
                value={(
                  <Link href={`tel:${toDialString(phone)}`} style={s.link}>
                    {formatPhone(phone)}
                  </Link>
                )}
              />
            )}
            {locationLabel && (
              <FieldRow label="City · ZIP" value={locationLabel} />
            )}
            <FieldRow label="Source" value={source} isLast />
          </Section>

          <Hr style={s.hr} />

          <Text style={s.footer}>
            <Link href={dashboardUrl} style={s.link}>Open dashboard</Link>
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

NewLeadEmail.PreviewProps = {
  name: 'Sean Yehuda',
  phone: '8185551234',
  city: 'Encino',
  zip: '91436',
  source: 'kitchens funnel',
  dashboardUrl: `${base}/dashboard/customers`,
} satisfies NewLeadEmailProps
