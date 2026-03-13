'use client'

import type { MeetingProgram } from '@/features/meetings/types'
import { ArrowRightIcon, CheckIcon } from 'lucide-react'
import { programAccentMap } from '@/features/meetings/constants/program-accent-map'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface ProgramCardProps {
  program: MeetingProgram
  onSelect: () => void
}

export function ProgramCard({ onSelect, program }: ProgramCardProps) {
  const accent = programAccentMap[program.accentColor]

  return (
    <Button
      className="group flex h-auto w-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:bg-card/60 hover:shadow-xl focus-visible:ring-primary text-left"
      variant="ghost"
      onClick={onSelect}
    >
      {/* Gradient header */}
      <div className={cn('p-6', accent.header)}>
        <span className={cn('inline-block rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider', accent.badge)}>
          {program.forWho}
        </span>
        <h2 className={cn('mt-4 text-2xl font-black leading-tight md:text-3xl', accent.name)}>
          {program.name}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground/60">
          {program.tagline}
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-5 p-6">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Best if:
          </p>
          <div className="flex flex-col gap-2.5">
            {program.signals.map(signal => (
              <div key={signal} className="flex items-start gap-2.5">
                <CheckIcon className={cn('mt-0.5 size-4 shrink-0', accent.check)} />
                <span className="text-sm leading-snug text-foreground/80">{signal}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          className={cn(
            'mt-auto flex items-center justify-between rounded-xl px-5 py-3.5 text-sm font-bold transition-all duration-200',
            accent.button,
          )}
        >
          Begin Program
          <ArrowRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
        </div>
      </div>
    </Button>
  )
}
