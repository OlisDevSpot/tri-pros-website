'use client'

import { CREDENTIAL_ITEMS, DUE_DILIGENCE_ITEMS } from '@/features/meetings/constants/due-diligence'
import { cn } from '@/shared/lib/utils'

interface WhoWeAreStepProps {
  className?: string
}

export function WhoWeAreStep({ className }: WhoWeAreStepProps) {
  return (
    <div className={cn('space-y-12', className)}>
      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 py-14 text-center shadow-xl md:px-12 md:py-20">
        {/* Subtle grid pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Accent glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 rounded-full bg-primary/20 blur-[100px]" />

        <div className="relative z-10 mx-auto max-w-2xl space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Tri Pros Remodeling
          </p>

          <h2 className="text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
            A successful project doesn&apos;t start on demolition day.
          </h2>

          <p className="text-lg leading-relaxed text-white/70 md:text-xl">
            It starts when you do your{' '}
            <span className="font-semibold text-white">due diligence</span>.
          </p>

          <div className="pt-2">
            <p className="text-sm text-white/50">
              We&apos;re here to show you what to look for — in any contractor, including us.
            </p>
          </div>
        </div>
      </div>

      {/* ── Credential Proof Bar ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {CREDENTIAL_ITEMS.map(item => (
          <div
            key={item.label}
            className="flex flex-col items-center gap-1 rounded-xl border border-border/40 bg-card/50 px-4 py-4 text-center shadow-sm"
          >
            <span className="text-lg font-bold tabular-nums tracking-tight text-foreground">
              {item.value}
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Section Intro ────────────────────────────────────────────────── */}
      <div className="space-y-2 text-center">
        <h3 className="text-xl font-bold tracking-tight md:text-2xl">
          The 6-Point Due Diligence Framework
        </h3>
        <p className="mx-auto max-w-lg text-sm text-muted-foreground">
          Before you hire any contractor, make sure they can answer all six.
          This is how you protect yourself.
        </p>
      </div>

      {/* ── Due Diligence Items ──────────────────────────────────────────── */}
      <div className="space-y-4">
        {DUE_DILIGENCE_ITEMS.map((item, index) => {
          const Icon = item.icon
          return (
            <div
              key={item.title}
              className="group relative flex gap-5 rounded-2xl border border-border/40 bg-card/50 p-5 shadow-sm transition-all hover:border-primary/20 hover:bg-card hover:shadow-md md:p-6"
            >
              {/* Number */}
              <div className="flex shrink-0 flex-col items-center gap-2">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold tabular-nums text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {index < DUE_DILIGENCE_ITEMS.length - 1 && (
                  <div className="h-full w-px bg-border/60" />
                )}
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col gap-1.5 pt-0.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <Icon className="size-4 shrink-0 text-primary/70" />
                    <h4 className="text-[15px] font-semibold leading-snug tracking-tight">
                      {item.title}
                    </h4>
                  </div>

                  {/* Stat badge */}
                  <div className="hidden shrink-0 flex-col items-end sm:flex">
                    <span className="text-sm font-bold tabular-nums text-foreground">
                      {item.stat}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {item.statLabel}
                    </span>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Closing Truth ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent px-8 py-10 text-center md:px-12">
        <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-primary/10 blur-[60px]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-24 rounded-full bg-primary/10 blur-[60px]" />

        <div className="relative z-10 mx-auto max-w-xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
            The real deal
          </p>
          <blockquote className="text-lg font-medium leading-relaxed tracking-tight text-foreground/90 md:text-xl">
            &ldquo;A successful remodeling project is not always about the finishes and nice
            design — many times success boils down to communication, supervision,
            leadership, and accountability.&rdquo;
          </blockquote>
          <p className="text-sm text-muted-foreground">
            All of this will ensure you have the real deal.
          </p>
        </div>
      </div>
    </div>
  )
}
