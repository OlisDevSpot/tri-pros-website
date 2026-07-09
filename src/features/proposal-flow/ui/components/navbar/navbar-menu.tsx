'use client'

import { ExternalLinkIcon, EyeIcon, FileTextIcon, MoreVerticalIcon, ShieldIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { useViewModeToggle } from '@/features/proposal-flow/hooks/use-view-mode-toggle'
import { getProposalPdfUrl } from '@/features/proposal-flow/lib/get-proposal-pdf-url'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
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
              ? 'h-full w-12 rounded-none hover:bg-foreground/40 data-[state=open]:bg-foreground/40'
              : 'size-11 rounded-lg shrink-0 bg-card/50 active:bg-card data-[state=open]:bg-card',
          )}
        >
          <MoreVerticalIcon className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-64 p-1.5">
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
                    <ExternalLinkIcon className="ml-auto size-3.5 text-muted-foreground/60" />
                  </a>
                </Button>
              </PopoverClose>
            )
          : (
              <Button
                type="button"
                variant="ghost"
                disabled
                className="w-full justify-start gap-2.5 min-h-11 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground/60"
              >
                <FileTextIcon className="size-4" />
                View as PDF
              </Button>
            )}

        {showViewToggle && (
          <>
            <div className="-mx-1.5 my-1.5 h-px bg-linear-to-r from-transparent via-border to-transparent" />
            <div className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Viewing as
            </div>
            <div role="radiogroup" aria-label="View mode" className="flex gap-1 p-1">
              <Button
                type="button"
                variant="ghost"
                role="radio"
                aria-checked={!isAgent}
                onClick={() => isAgent && toggle()}
                className={cn(
                  'flex-1 gap-1.5 min-h-11 rounded-md text-sm font-medium',
                  !isAgent
                    ? 'bg-primary/20 text-primary hover:bg-primary/20 hover:text-primary'
                    : 'text-muted-foreground hover:bg-muted/40',
                )}
              >
                <EyeIcon className="size-4" />
                Homeowner
              </Button>
              <Button
                type="button"
                variant="ghost"
                role="radio"
                aria-checked={isAgent}
                onClick={() => !isAgent && toggle()}
                className={cn(
                  'flex-1 gap-1.5 min-h-11 rounded-md text-sm font-medium',
                  isAgent
                    ? 'bg-destructive/20 text-destructive hover:bg-destructive/20 hover:text-destructive'
                    : 'text-muted-foreground hover:bg-muted/40',
                )}
              >
                <ShieldIcon className="size-4" />
                Agent
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
