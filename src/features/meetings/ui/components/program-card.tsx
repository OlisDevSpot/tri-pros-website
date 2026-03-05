'use client'

import type { MeetingProgram } from '@/features/meetings/types'
import { ArrowRightIcon, CheckIcon } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/shared/lib/utils'

interface ProgramCardProps {
  contactId?: string
  program: MeetingProgram
}

const accentMap = {
  amber: {
    badge: 'bg-amber-500/15 text-amber-300 border border-amber-700/30',
    button: 'bg-amber-500 text-black group-hover:bg-amber-400',
    check: 'text-amber-400',
    header: 'bg-linear-to-br from-amber-900/60 to-amber-800/10 border-b border-amber-800/40',
    name: 'text-amber-300',
  },
  sky: {
    badge: 'bg-sky-500/15 text-sky-300 border border-sky-700/30',
    button: 'bg-sky-500 text-black group-hover:bg-sky-400',
    check: 'text-sky-400',
    header: 'bg-linear-to-br from-sky-900/60 to-sky-800/10 border-b border-sky-800/40',
    name: 'text-sky-300',
  },
  violet: {
    badge: 'bg-violet-500/15 text-violet-300 border border-violet-700/30',
    button: 'bg-violet-500 text-white group-hover:bg-violet-400',
    check: 'text-violet-400',
    header: 'bg-linear-to-br from-violet-900/60 to-violet-800/10 border-b border-violet-800/40',
    name: 'text-violet-300',
  },
} as const

export function ProgramCard({ contactId, program }: ProgramCardProps) {
  const accent = accentMap[program.accentColor]
  const href = contactId ? `/meetings/${program.id}?contactId=${contactId}` : `/meetings/${program.id}`

  return (
    <Link
      className="group flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/60 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      href={href}
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
    </Link>
  )
}
