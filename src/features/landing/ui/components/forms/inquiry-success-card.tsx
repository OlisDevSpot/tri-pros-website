'use client'

import { CheckCircle2, Mail, MessageSquare, Phone } from 'lucide-react'
import { motion } from 'motion/react'
import Link from 'next/link'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'

interface RecapItem {
  label: string
  value: string
}

interface Props {
  firstName: string
  email: string
  smsConsent: boolean
  callConsent: boolean
  recapItems: RecapItem[]
}

export function InquirySuccessCard({
  firstName,
  email,
  smsConsent,
  callConsent,
  recapItems,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col gap-6 rounded-xl border border-border/30 bg-card p-6 text-left shadow"
    >
      {/* Hero */}
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <div className="rounded-full bg-emerald-500/10 p-3">
          <CheckCircle2 className="size-9 text-emerald-600" strokeWidth={2.25} />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          We got your inquiry,
          {' '}
          {firstName}
          .
        </h2>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          Confirmation sent to
          {' '}
          <span className="font-medium text-foreground">{email}</span>
          {' '}
          — check your inbox.
        </p>
      </div>

      {/* What to expect */}
      <div className="space-y-3 border-t border-border/40 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          What to expect
        </p>

        <Step
          number={1}
          icon={<Mail className="size-4" />}
          title="Confirmation email"
          body={`Just sent to ${email}.`}
        />
        <Step
          number={2}
          icon={<Phone className="size-4" />}
          title="Call within 24 hours"
          body={
            callConsent
              ? 'A team member will phone you to discuss scope and timing.'
              : 'A team member will call about this inquiry. You can opt in to broader updates anytime.'
          }
        />
        {smsConsent && (
          <Step
            number={3}
            icon={<MessageSquare className="size-4" />}
            title="SMS confirmation"
            body="Once a time is set, we'll text to confirm the appointment. Reply STOP at any time to opt out."
          />
        )}
      </div>

      {/* Recap */}
      {recapItems.length > 0 && (
        <div className="space-y-3 border-t border-border/40 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your inquiry
          </p>
          <dl className="space-y-3 rounded-lg border border-border/30 bg-muted/20 p-4 text-sm">
            {recapItems.map(item => (
              <div key={item.label} className="grid grid-cols-[110px_1fr] gap-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </dt>
                <dd className="leading-relaxed text-foreground/90">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Secondary CTAs */}
      <div className="flex flex-col gap-3 border-t border-border/40 pt-5 sm:flex-row">
        <Button asChild variant="outline" className="flex-1">
          <Link href={ROOTS.landing.portfolioProjects()}>Browse our portfolio</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href={ROOTS.landing.services()}>Explore services</Link>
        </Button>
      </div>
    </motion.div>
  )
}

function Step({
  number,
  icon,
  title,
  body,
}: {
  number: number
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="flex-1 space-y-0.5">
        <p className="text-sm font-medium text-foreground">
          <span className="mr-1 text-xs font-semibold text-muted-foreground">
            {number}
            .
          </span>
          {title}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}
