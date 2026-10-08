'use client'

import { ExternalLinkIcon, EyeIcon, FileTextIcon, MoreVerticalIcon, ShieldIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { useViewModeToggle } from '@/features/proposal-flow/hooks/use-view-mode-toggle'
import { getProposalPdfUrl } from '@/features/proposal-flow/lib/get-proposal-pdf-url'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { cn } from '@/shared/lib/utils'

interface Props {
  variant: 'desktop' | 'mobile'
}

/**
 * Kebab menu for auxiliary proposal-flow actions: "View as PDF" (everyone)
 * and the agent/homeowner view-mode toggle (CASL-gated). Replaces the old
 * fixed desktop pill and the mobile navbar toggle icon.
 */
export function ProposalNavbarMenu({ variant }: Props) {
  const proposal = useCurrentProposal()
  const ability = useAbility()
  const { isAgent, toggle } = useViewModeToggle()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const proposalId = proposal.data?.id
  const token = proposal.data?.token
  const pdfUrl = proposalId && token ? getProposalPdfUrl(proposalId, token) : null
  const showViewToggle = mounted && ability.can('update', 'Proposal')

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label="Proposal options"
          className={cn(
            variant === 'desktop'
              ? 'h-full w-12 rounded-none data-[state=open]:bg-press'
              : 'size-9 rounded-lg shrink-0 data-[state=open]:bg-press',
          )}
        >
          <MoreVerticalIcon className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-64 p-1.5">
        {/* PopoverClose asChild → Button asChild → <a>: Radix Slot composition collapses all three onto the single anchor */}
        {pdfUrl
          ? (
              <PopoverClose asChild>
                <Button
                  asChild
                  variant="ghost"
                  className="w-full justify-start gap-2.5 min-h-11 rounded-md px-3 py-2.5 text-sm font-medium"
                >
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                    <FileTextIcon className="size-4 text-muted-foreground" />
                    View as PDF
                    <ExternalLinkIcon className="ml-auto size-3.5 text-muted-foreground" />
                  </a>
                </Button>
              </PopoverClose>
            )
          : (
              <Button
                type="button"
                variant="ghost"
                disabled
                className="w-full justify-start gap-2.5 min-h-11 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground"
              >
                <FileTextIcon className="size-4" />
                View as PDF
              </Button>
            )}

        {showViewToggle && (
          <>
            <div className="-mx-1.5 my-1.5 h-px bg-border" />
            <div className="px-3 pt-1.5 pb-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Viewing as
            </div>
            <ToggleGroup
              type="single"
              variant="segmented"
              aria-label="View mode"
              value={isAgent ? 'agent' : 'homeowner'}
              onValueChange={(value) => {
                if (value && (value === 'agent') !== isAgent)
                  toggle()
              }}
              className="mx-1 mb-1 w-[calc(100%-0.5rem)]"
            >
              <ToggleGroupItem value="homeowner" className="h-10 flex-1 gap-1.5">
                <EyeIcon className="size-4" />
                Homeowner
              </ToggleGroupItem>
              <ToggleGroupItem value="agent" className="h-10 flex-1 gap-1.5">
                <ShieldIcon className="size-4" />
                Agent
              </ToggleGroupItem>
            </ToggleGroup>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
