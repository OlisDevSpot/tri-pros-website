'use client'

import { COMPANY_PHONE } from '@/features/proposal-flow/constants/company-phone'
import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { scrollToChapter } from '@/features/proposal-flow/lib/scroll-to-chapter'
import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { EmailAction } from '@/shared/components/contact-actions/ui/email-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { companyInfo } from '@/shared/constants/company'

export function OverviewContextCard() {
  const { proposal } = useProposalDocument()
  const c = proposal.customer
  const address = c ? [c.address, [c.city, c.state, c.zip].filter(Boolean).join(', ')].filter(Boolean).join(', ') : ''
  const sow = proposal.projectJSON.data.sow

  return (
    <div className="mx-auto -mt-6 grid max-w-5xl gap-6 px-4 pb-12 sm:px-8">
      <div className="grid overflow-hidden rounded-lg border border-border bg-card shadow-sm @min-[700px]/proposal:grid-cols-2">
        <div className="grid content-start gap-3 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Prepared for</p>
          <p className="text-xl font-semibold">{c?.name}</p>
          <div className="grid gap-1 text-sm text-muted-foreground">
            {address && <AddressAction address={address} />}
            {c?.phone && <PhoneAction phone={c.phone} />}
            {c?.email && <EmailAction email={c.email} />}
          </div>
        </div>
        <div className="grid content-start gap-3 border-t border-border p-5 @min-[700px]/proposal:border-l @min-[700px]/proposal:border-t-0">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your consultant</p>
          {/* The owner profile isn't on the read yet, so the company stands in for the consultant. */}
          <p className="font-semibold">{companyInfo.name}</p>
          {COMPANY_PHONE && <PhoneAction phone={COMPANY_PHONE} />}
        </div>
      </div>
      <div className="grid gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">What’s in this proposal</p>
        <ol className="grid gap-2 @min-[700px]/proposal:grid-cols-2">
          {sow.map((section, i) => (
            <li key={`part-${String(i + 1).padStart(2, '0')}`}>
              <button
                type="button"
                onClick={() => scrollToChapter(`scope-part-${i + 1}`)}
                className="grid min-h-12 w-full grid-cols-[2rem_1fr] items-center rounded-md border border-border bg-card px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-row-hover pressed:bg-row-press"
              >
                <span className="tabular-nums text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                <span>
                  {section.title || `Part ${i + 1}`}
                  {section.trade.label && <span className="block text-xs font-normal text-muted-foreground">{section.trade.label}</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
