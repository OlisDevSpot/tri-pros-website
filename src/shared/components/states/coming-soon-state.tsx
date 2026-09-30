'use client'

import { Check, HardHat } from 'lucide-react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'

const EMAIL_RE = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/

interface ComingSoonStateProps {
  id?: string
  className?: string
  size?: 'inline' | 'section' | 'page'
  eyebrow?: string
  title?: string
  description?: string
  showProgress?: boolean
  progress?: number
  progressLabel?: string
  showForm?: boolean
  ctaLabel?: string
  homeHref?: string
  homeLabel?: string
}

const DEFAULTS = {
  eyebrow: 'Pardon our dust',
  title: 'We\'re still\nbuilding this page',
  description:
    'Our crew is pouring the foundation, raising the walls, and hammering out the details. This corner of the site will be move-in ready soon.',
  ctaLabel: 'Notify me',
  homeHref: '/',
  homeLabel: '← Back to homepage',
  progress: 64,
  progressLabel: 'Framing',
}

const ENTER_EASE = [0.2, 0.9, 0.4, 1] as const

export function ComingSoonState({
  size = 'page',
  eyebrow = DEFAULTS.eyebrow,
  title = DEFAULTS.title,
  description = DEFAULTS.description,
  showProgress = size === 'page',
  progress = DEFAULTS.progress,
  progressLabel = DEFAULTS.progressLabel,
  showForm = size !== 'inline',
  ctaLabel = DEFAULTS.ctaLabel,
  homeHref = DEFAULTS.homeHref,
  homeLabel = DEFAULTS.homeLabel,
  className,
  id,
}: ComingSoonStateProps) {
  if (size === 'inline') {
    return (
      <div className={cn('flex w-full items-center justify-center rounded-lg border border-dashed border-border bg-card/60 px-8 py-6', className)} id={id}>
        <div className="flex max-w-fit items-center gap-3">
          <span className="grid size-8 flex-none place-items-center rounded-[8px] border border-primary/35 bg-primary/14 text-primary">
            <HardHat className="size-4" />
          </span>
          <div className="flex flex-col gap-0.5 text-left">
            <p className="font-semibold">{title.replace(/\n/g, ' ')}</p>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        id={id}
        className={cn(
          'relative w-full overflow-hidden bg-background bg-[linear-gradient(var(--color-cs-grid)_1px,transparent_1px),linear-gradient(90deg,var(--color-cs-grid)_1px,transparent_1px)] bg-size-[32px_32px,32px_32px] text-foreground',
          // Arbitrary pseudo variants, not before:/after:, which would inject `content` and give every descendant a pseudo box.
          'motion-reduce:**:paused! motion-reduce:**:[transition:none]! motion-reduce:[&_*::before]:paused! motion-reduce:[&_*::before]:[transition:none]! motion-reduce:[&_*::after]:paused! motion-reduce:[&_*::after]:[transition:none]!',
          size === 'page'
            ? 'grid min-h-dvh px-4 pt-[calc(var(--navbar-bottom,var(--navbar-height,80px))+0.75rem)] pb-3 sm:px-8 lg:h-dvh lg:max-h-dvh lg:px-14 lg:pt-[calc(var(--navbar-bottom,var(--navbar-height,80px))+1rem)] lg:pb-4'
            : 'rounded-[22px] border border-border p-6',
          className,
        )}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: ENTER_EASE }}
      >
        <div className="relative z-2 flex size-full flex-col items-center justify-center gap-[18px] rounded-[6px] border-[1.5px] border-dashed border-[oklch(from_var(--primary)_l_c_h/0.5)] bg-[linear-gradient(180deg,oklch(from_var(--primary)_l_c_h/0.09)_0%,oklch(from_var(--primary)_l_c_h/0.02)_55%,oklch(from_var(--card)_l_c_h/0.06)_100%)] px-6 py-7 text-center [backdrop-filter:blur(2px)] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-[1fr_auto_auto_1fr] lg:items-center lg:gap-x-8 lg:gap-y-5 lg:px-12 lg:py-10 lg:[grid-template-areas:'._scene'_'top_scene'_'bottom_scene'_'._scene']">
          <motion.div
            className="flex w-full flex-col items-center gap-3.5 text-center lg:[align-self:end] lg:[grid-area:top]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05, ease: ENTER_EASE }}
          >
            <span className="inline-flex items-center gap-[9px] self-center rounded-[999px] border border-[oklch(from_var(--primary)_l_c_h/0.35)] bg-cs-accent-soft px-[13px] py-[7px] text-xs font-bold whitespace-nowrap text-primary uppercase tracking-[0.24em]">
              <span className="size-0 border-x-[5px] border-b-[10px] border-x-transparent border-b-primary filter-[drop-shadow(0_1px_0_var(--color-cs-accent-d))]" aria-hidden="true" />
              {eyebrow}
            </span>
            <Headline title={title} />
            <p className="max-w-[56ch] text-[clamp(14px,1.4vw,17px)] leading-[1.55] text-pretty text-muted-foreground">{description}</p>
          </motion.div>

          <motion.div
            className="w-full lg:self-center lg:justify-self-center lg:[grid-area:scene]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.15, ease: ENTER_EASE }}
          >
            <ConstructionScene />
          </motion.div>

          <motion.div
            className="flex w-full flex-col items-center gap-3.5 text-center lg:[align-self:start] lg:[grid-area:bottom]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: ENTER_EASE }}
          >
            {showProgress && <ProgressBar value={progress} label={progressLabel} />}
            {showForm && <NotifyForm ctaLabel={ctaLabel} />}
            {homeHref && (
              <div className="text-xs font-semibold uppercase tracking-widest">
                <a href={homeHref} className="border-b-2 border-b-primary pb-0.5 text-foreground no-underline [transition:color_0.15s] [&:hover]:text-primary">{homeLabel}</a>
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </MotionConfig>
  )
}

function Headline({ title }: { title: string }) {
  const lines = title.split('\n')
  return (
    <h1 className="mt-1 [font-family:var(--font-sans),system-ui,sans-serif] text-[clamp(35px,4.85vw,60px)] leading-[0.96] font-bold tracking-[-0.008em] text-balance uppercase">
      {lines.map((line, i) => {
        const isLast = i === lines.length - 1
        return (
          <span key={line}>
            {isLast ? <span className="text-primary">{line}</span> : line}
            {!isLast && <br />}
          </span>
        )
      })}
    </h1>
  )
}

function ProgressBar({ value, label }: { value: number, label: string }) {
  const safe = Math.max(0, Math.min(100, value))
  return (
    <div
      className="w-[min(420px,100%)] text-left"
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Site progress"
    >
      <div className="mb-1.5 flex items-baseline justify-between text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        <span>Site progress</span>
        <b className="font-bold text-foreground">
          {safe}
          %
          {' '}
          ·
          {' '}
          {label}
        </b>
      </div>
      <div className="h-3 overflow-hidden rounded-[999px] border border-border bg-cs-card-bar p-0.5">
        <motion.div
          className="h-full animate-cs-barber rounded-[999px] bg-[repeating-linear-gradient(-45deg,var(--primary)_0,var(--primary)_9px,var(--color-cs-accent-d)_9px,var(--color-cs-accent-d)_18px)] bg-size-[25.5px_25.5px] [transition:width_1.1s_cubic-bezier(0.4,0,0.2,1)]"
          initial={{ width: 0 }}
          animate={{ width: `${safe}%` }}
          transition={{ duration: 1.1, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
    </div>
  )
}

function NotifyForm({ ctaLabel }: { ctaLabel: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'error' | 'done'>('idle')

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) {
      setState('error')
      return
    }
    // Client-only confirmation for now — wire to email service later.
    setState('done')
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {state === 'done'
        ? (
            <motion.div
              key="success"
              className="flex w-[min(420px,100%)] items-center gap-2.5 rounded-[12px] border border-primary bg-card px-4 py-3 text-left text-sm text-foreground"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3, ease: ENTER_EASE }}
              role="status"
              aria-live="polite"
            >
              <span className="grid size-[22px] flex-none place-items-center rounded-[50%] bg-primary text-primary-foreground [&_svg]:size-[14px]" aria-hidden="true">
                <Check strokeWidth={3} />
              </span>
              You're on the list — we'll send a hard-hat heads-up the moment it's live.
            </motion.div>
          )
        : (
            <motion.div
              key="form"
              className="flex w-[min(420px,100%)] flex-col items-center gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <form className="flex w-full gap-2 *:first:flex-1" onSubmit={submit} noValidate>
                <Input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  aria-label="Email address"
                  aria-invalid={state === 'error'}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (state === 'error') {
                      setState('idle')
                    }
                  }}
                />
                <Button type="submit">{ctaLabel}</Button>
              </form>
              <div
                className={cn('min-h-4 w-[min(420px,100%)] text-left text-xs', state === 'error' ? 'text-destructive' : 'text-muted-foreground')}
                role={state === 'error' ? 'alert' : undefined}
              >
                {state === 'error'
                  ? 'Hmm, that email looks off the level — try again.'
                  : 'Get a heads-up the moment we cut the ribbon.'}
              </div>
            </motion.div>
          )}
    </AnimatePresence>
  )
}

// Drawn on a fixed 900×480 stage scaled to the container width (container query), so
// first paint matches final paint. Coordinates are stage pixels, hence the px values.
function ConstructionScene() {
  return (
    <div
      className="@container relative mx-auto aspect-900/480 w-full max-w-[832px] lg:max-w-[780px]"
      role="img"
      aria-label="A small construction scene: a tower crane lowering a content block onto a webpage card while an excavator digs at the base."
    >
      <div className="absolute top-0 left-0 h-[480px] w-[900px] origin-top-left transform-[scale(min(1,calc(100cqi/900px)))]">
        <div className="absolute inset-x-0 bottom-0 h-[70px] bg-cs-dirt before:absolute before:inset-x-0 before:-top-[6px] before:h-[6px] before:bg-[repeating-linear-gradient(-45deg,var(--color-cs-steel-l)_0_10px,var(--color-cs-shadow)_10px_20px)] before:opacity-55" />
        <div className="absolute bottom-[56px] left-[150px] h-[46px] w-[150px] rounded-[80px_70px_0_0/60px_50px_0_0] bg-cs-dirt-d after:absolute after:inset-[10px_26px_auto] after:h-[10px] after:rounded-[40px] after:bg-cs-dirt after:opacity-50" />

        <div className="absolute top-[150px] left-[318px] h-[280px] w-[348px] overflow-hidden rounded-[10px] border border-border bg-card [box-shadow:0_18px_40px_oklch(0_0_0/0.45)]">
          <div className="flex h-[34px] items-center gap-[7px] border-b border-border bg-cs-card-bar px-3.5">
            <span className="size-[11px] rounded-[50%] bg-[oklch(0.65_0.16_28)] opacity-70" />
            <span className="size-[11px] rounded-[50%] bg-[oklch(0.78_0.13_80)] opacity-70" />
            <span className="size-[11px] rounded-[50%] bg-[oklch(0.7_0.16_145)] opacity-70" />
            <span className="ml-2.5 h-3 max-w-[180px] flex-1 rounded-[6px] bg-border" />
          </div>
          <div className="flex flex-col gap-3.5 p-[18px]">
            <div className="h-14 rounded-[7px] bg-cs-solid-block" />
            <div className="flex gap-3.5">
              <div className="h-16 w-[84px] flex-none rounded-[7px] bg-cs-solid-block" />
              <div className="flex flex-1 flex-col justify-center gap-2.5">
                <div className="h-3.5 w-[90%] rounded-[7px] bg-cs-solid-block" />
                <div className="h-3.5 w-[70%] rounded-[7px] bg-cs-solid-block" />
              </div>
            </div>
            <div className="relative h-3.5 w-[90%] overflow-hidden rounded-[7px] border border-dashed border-cs-ghost-line bg-transparent after:absolute after:inset-0 after:animate-cs-shimmer after:bg-[linear-gradient(100deg,transparent_35%,var(--color-cs-ghost-line)_50%,transparent_65%)] after:opacity-28 after:transform-[translateX(-100%)]">
              <span className="absolute inset-0 animate-cs-pulse-target rounded-[7px] border border-dashed border-primary opacity-65" />
            </div>
            <div className="relative h-3.5 w-[70%] overflow-hidden rounded-[7px] border border-dashed border-cs-ghost-line bg-transparent after:absolute after:inset-0 after:animate-cs-shimmer after:bg-[linear-gradient(100deg,transparent_35%,var(--color-cs-ghost-line)_50%,transparent_65%)] after:opacity-28 after:transform-[translateX(-100%)]" />
          </div>
        </div>

        <div className="absolute top-[196px] left-[360px] size-4 animate-cs-landpuff rounded-[50%] bg-cs-ghost-line opacity-0" />
        <div className="absolute top-[198px] left-[392px] size-[22px] animate-cs-landpuff rounded-[50%] bg-cs-ghost-line opacity-0" />
        <div className="absolute top-[196px] left-[420px] size-[14px] animate-cs-landpuff rounded-[50%] bg-cs-ghost-line opacity-0" />

        <div className="absolute top-0 left-0 h-[480px] w-[900px] origin-[703px_410px] animate-cs-sway">
          <div className="absolute top-[58px] left-[690px] h-[352px] w-[26px] rounded-[2px] [background:repeating-linear-gradient(45deg,transparent_0_7px,var(--color-cs-steel-l)_7px_8px),repeating-linear-gradient(-45deg,transparent_0_7px,var(--color-cs-steel-l)_7px_8px),var(--color-cs-steel)]" />
          <div className="absolute top-[18px] left-[690px] size-0 border-x-[13px] border-b-[42px] border-x-transparent border-b-cs-steel" />
          <div className="absolute top-[46px] left-[716px] h-[13px] w-[120px] rounded-[3px] bg-primary" />
          <div className="absolute top-[34px] left-[800px] h-[34px] w-[40px] rounded-[3px] bg-cs-steel" />
          <div className="absolute top-[46px] left-[360px] h-[13px] w-[356px] rounded-[3px] bg-primary before:absolute before:right-[4px] before:-top-[9px] before:left-[40px] before:h-[9px] before:bg-[repeating-linear-gradient(60deg,transparent_0_10px,var(--color-cs-accent-d)_10px_12px)]" />
          <div className="absolute top-[24px] left-[678px] size-[22px] rounded-[3px] bg-cs-accent-l" />
          <div className="absolute top-[59px] left-[430px] h-[18px] w-[3px] animate-cs-rigdrop">
            <div className="absolute -top-[6px] -left-[10px] h-[12px] w-[24px] rounded-[2px] bg-cs-steel" />
            <div className="absolute top-0 left-0 h-full w-[3px] bg-cs-shadow opacity-55" />
            <div className="absolute -bottom-[7px] -left-[2.5px] size-[8px] rounded-[0_0_6px_6px] border-2 border-cs-steel [border-top:none]" />
            <div className="absolute top-full -left-[56px] h-[34px] w-[112px] animate-cs-loadfade rounded-[6px] bg-primary [box-shadow:inset_0_0_0_3px_oklch(1_0_0/0.2)] after:absolute after:inset-x-0 after:-top-[12px] after:h-[12px] after:opacity-45 after:[background:linear-gradient(var(--color-cs-shadow),var(--color-cs-shadow))_28%_0/2px_12px_no-repeat,linear-gradient(var(--color-cs-shadow),var(--color-cs-shadow))_72%_0/2px_12px_no-repeat]" />
          </div>
        </div>

        <div className="absolute bottom-[60px] left-[60px] h-[120px] w-[190px]">
          <div className="absolute bottom-0 left-2 h-9 w-[150px] rounded-[20px] bg-cs-steel before:absolute before:top-[7px] before:left-3 before:size-[22px] before:rounded-[50%] before:bg-cs-shadow before:opacity-40 after:absolute after:top-[7px] after:right-3 after:size-[22px] after:rounded-[50%] after:bg-cs-shadow after:opacity-40" />
          <div className="absolute bottom-[30px] left-[70px] h-[58px] w-[86px] rounded-[9px_9px_4px_4px] bg-primary before:absolute before:top-[9px] before:left-[11px] before:h-[28px] before:w-[36px] before:rounded-[5px] before:bg-card before:opacity-85 after:absolute after:-top-[10px] after:right-3 after:h-3 after:w-[7px] after:rounded-[3px] after:bg-cs-steel" />
          <div className="absolute bottom-[56px] left-[78px] size-1 origin-center animate-cs-dig">
            <div className="absolute -top-[7px] left-0 h-[13px] w-[92px] origin-left rounded-[6px] bg-cs-accent-d transform-[rotate(-26deg)]">
              <div className="absolute -top-[46px] left-[82px] h-[54px] w-3 origin-top rounded-[6px] bg-primary transform-[rotate(40deg)]">
                <div className="absolute top-[47px] -left-[9px] h-6 w-7 bg-cs-steel [clip-path:polygon(0_0,100%_0,78%_100%,18%_100%)]" />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-[92px] left-[168px] size-[22px] animate-cs-puff rounded-[50%] bg-cs-dirt-d opacity-0" />
        <div className="absolute bottom-[96px] left-[188px] size-[30px] animate-[cs-puff_3.2s_ease-out_infinite_0.15s] rounded-[50%] bg-cs-dirt-d opacity-0" />
        <div className="absolute bottom-[90px] left-[210px] size-[18px] animate-[cs-puff_3.2s_ease-out_infinite_0.3s] rounded-[50%] bg-cs-dirt-d opacity-0" />
        <div className="absolute bottom-[120px] left-[300px] size-[5px] animate-cs-drift rounded-[50%] bg-foreground opacity-12" />
        <div className="absolute bottom-[90px] left-[520px] size-[5px] animate-[cs-drift_9s_linear_infinite_1.5s] rounded-[50%] bg-foreground opacity-12" />
        <div className="absolute bottom-[150px] left-[640px] size-[5px] animate-[cs-drift_8s_linear_infinite_3s] rounded-[50%] bg-foreground opacity-12" />
      </div>
    </div>
  )
}
