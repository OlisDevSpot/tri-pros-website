'use client'

import { ExternalLinkIcon, FileTextIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface Props {
  pdfUrl: string
}

export function PdfFallbackCard({ pdfUrl }: Props) {
  return (
    <section aria-labelledby="pdf-fallback-title">
      <div className="mx-auto mb-12 h-px w-2/3 bg-border" />

      <div
        className={cn(
          'rounded-xl border border-border bg-card shadow-sm',
          'flex flex-col items-center gap-5 px-6 py-8 text-center',
          'sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8 sm:py-6 sm:text-left',
        )}
      >
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-foreground ring-1 ring-border">
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
          className="w-full max-sm:h-11 sm:w-auto shrink-0"
        >
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            <FileTextIcon />
            View PDF
            <ExternalLinkIcon className="size-3.5" />
          </a>
        </Button>
      </div>
    </section>
  )
}
