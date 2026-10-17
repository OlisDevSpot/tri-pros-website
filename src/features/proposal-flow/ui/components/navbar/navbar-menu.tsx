'use client'

import { ExternalLinkIcon, FileTextIcon, MoreVerticalIcon, PhoneIcon } from 'lucide-react'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { getProposalPdfUrl } from '@/features/proposal-flow/lib/get-proposal-pdf-url'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { companyInfo, companyPhone } from '@/shared/constants/company'
import { cn } from '@/shared/lib/utils'

const MENU_ROW = 'w-full justify-start gap-2.5 min-h-11 rounded-md px-3 py-2.5 text-sm font-medium'

export function ProposalNavbarMenu() {
  const { proposal, token, canAct } = useProposalDocument()

  const pdfToken = proposal.token ?? token
  const pdfUrl = pdfToken ? getProposalPdfUrl(proposal.id, pdfToken) : null

  // The label names whoever answers that number: the owner rep, or the company line when the rep has no phone.
  const ownerRep = proposal.meetingReps[0]
  const contactPhone = ownerRep?.phone ?? companyPhone
  const contactName = ownerRep?.phone ? ownerRep.name.trim().split(/\s+/)[0] : companyInfo.nickname

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label="Proposal options"
          className="size-11 shrink-0 rounded-md data-[state=open]:bg-press sm:size-9"
        >
          <MoreVerticalIcon className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-64 p-1.5">
        {/* PopoverClose asChild → Button asChild → <a>: Radix Slot composition collapses all three onto the single anchor */}
        {pdfUrl
          ? (
              <PopoverClose asChild>
                <Button asChild variant="ghost" className={MENU_ROW}>
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                    <FileTextIcon className="size-4 text-muted-foreground" />
                    View as PDF
                    <ExternalLinkIcon className="ml-auto size-3.5 text-muted-foreground" />
                  </a>
                </Button>
              </PopoverClose>
            )
          : (
              <Button type="button" variant="ghost" disabled className={cn(MENU_ROW, 'text-muted-foreground')}>
                <FileTextIcon className="size-4" />
                View as PDF
              </Button>
            )}

        {!canAct && contactPhone && (
          <PhoneAction phone={contactPhone}>
            <Button type="button" variant="ghost" className={MENU_ROW}>
              <PhoneIcon className="size-4 text-muted-foreground" />
              {`Call or text ${contactName}`}
            </Button>
          </PhoneAction>
        )}
      </PopoverContent>
    </Popover>
  )
}
