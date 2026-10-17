'use client'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { repsPhrase } from '@/features/proposal-flow/lib/rep-names'
import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { EmailAction } from '@/shared/components/contact-actions/ui/email-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { formatBusinessTime } from '@/shared/lib/business-time'
import { formatCustomerAddress } from '@/shared/lib/formatters'

export function OverviewFacts() {
  const { proposal } = useProposalDocument()
  const customer = proposal.customer
  const address = customer ? formatCustomerAddress(customer) : null
  const reps = proposal.meetingReps
  const visitDate = proposal.meetingScheduledFor
    ? formatBusinessTime(new Date(proposal.meetingScheduledFor), { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="grid overflow-hidden rounded-xl border border-border bg-card @min-[700px]/proposal:grid-cols-2">
      <div className="grid content-start gap-2 px-5 py-4.5">
        <p className="text-xs leading-tight font-bold tracking-[0.14em] text-muted-foreground uppercase">Prepared for</p>
        {customer?.name && <p className="font-sans text-xl font-medium">{customer.name}</p>}
        <div className="grid gap-1 text-base text-muted-foreground">
          {address?.hasAddress && <AddressAction address={address.singleLine} />}
          {customer?.phone && <PhoneAction phone={customer.phone} />}
          {customer?.email && <EmailAction email={customer.email} />}
        </div>
      </div>
      <div className="grid content-start gap-2 border-t border-border px-5 py-4.5 @min-[700px]/proposal:border-t-0 @min-[700px]/proposal:border-l">
        <p className="text-xs leading-tight font-bold tracking-[0.14em] text-muted-foreground uppercase">Your visit</p>
        {visitDate && <p className="font-sans text-lg">{visitDate}</p>}
        <p className="text-sm text-muted-foreground">{`${repsPhrase(reps, { sentenceStart: true })} visited and wrote this plan with you.`}</p>
        {reps.length > 0 && (
          <div className="grid gap-1 text-base text-muted-foreground">
            {reps.map(rep => <EmailAction key={rep.email} email={rep.email} />)}
          </div>
        )}
      </div>
    </div>
  )
}
