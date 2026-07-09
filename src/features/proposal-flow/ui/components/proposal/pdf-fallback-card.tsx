'use client'

import { ExternalLinkIcon, FileTextIcon } from 'lucide-react'

import { useViewMode } from '@/features/proposal-flow/hooks/use-view-mode'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface Props {
  pdfUrl: string
}

/**
 * End-of-flow fallback for customers who prefer a classic document. A slim
 * frosted band — intentionally quieter than the proposal sections above it.
 */
export function PdfFallbackCard({ pdfUrl }: Props) {
  const isAgent = useViewMode() === 'agent'

  return (
    <section aria-labelledby="pdf-fallback-title">
      <div className="mx-auto mb-12 h-px w-2/3 bg-linear-to-r from-transparent via-border to-transparent" />

      <div
        className={cn(
          'rounded-xl border border-border/50 bg-card/60 backdrop-blur-md shadow-sm',
          'bg-linear-to-br from-card/80 to-card/40',
          'flex flex-col items-center gap-5 px-6 py-8 text-center',
          'sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8 sm:py-6 sm:text-left',
        )}
      >
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <div
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-full ring-1',
              isAgent
                ? 'bg-destructive/10 text-destructive ring-destructive/20'
                : 'bg-primary/10 text-primary ring-primary/20',
            )}
          >
            <FileTextIcon className="size-5" />
          </div>
          <div className="space-y-1">
            <p id="pdf-fallback-title" className="text-base font-semibold tracking-tight">
              Prefer a classic PDF?
            </p>
            <p className="text-sm font-light text-muted-foreground">
              View the complete proposal as a printable document.
            </p>
          </div>
        </div>

        <Button
          asChild
          size="lg"
          variant={isAgent ? 'destructive' : 'default'}
          className="w-full max-sm:h-11 sm:w-auto shrink-0"
        >
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            <FileTextIcon />
            View PDF
            <ExternalLinkIcon className="size-3.5 opacity-70" />
          </a>
        </Button>
      </div>
    </section>
  )
}
