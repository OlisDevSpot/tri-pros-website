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
      <div className={cn('cs-inline-root', className)} id={id}>
        <div className="cs-inline-body">
          <span className="cs-inline-icon">
            <HardHat className="size-4" />
          </span>
          <div className="cs-inline-text">
            <p className="cs-inline-title">{title.replace(/\n/g, ' ')}</p>
            {description && <p className="cs-inline-desc">{description}</p>}
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
          'coming-soon-state',
          size === 'page' ? 'cs-full' : 'cs-section',
          className,
        )}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: ENTER_EASE }}
      >
        <div className="cs-wrap">
          <motion.div
            className="cs-top-group"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05, ease: ENTER_EASE }}
          >
            <span className="cs-eyebrow">
              <span className="cs-cone" aria-hidden="true" />
              {eyebrow}
            </span>
            <Headline title={title} />
            <p className="cs-sub">{description}</p>
          </motion.div>

          <motion.div
            className="cs-scene-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.15, ease: ENTER_EASE }}
          >
            <ConstructionScene />
          </motion.div>

          <motion.div
            className="cs-bottom-group"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: ENTER_EASE }}
          >
            {showProgress && <ProgressBar value={progress} label={progressLabel} />}
            {showForm && <NotifyForm ctaLabel={ctaLabel} />}
            {homeHref && (
              <div className="cs-secondary">
                <a href={homeHref}>{homeLabel}</a>
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
    <h1 className="cs-title">
      {lines.map((line, i) => {
        const isLast = i === lines.length - 1
        return (
          <span key={line}>
            {isLast ? <span className="cs-title-hl">{line}</span> : line}
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
      className="cs-progress"
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Site progress"
    >
      <div className="cs-progress-head">
        <span>Site progress</span>
        <b>
          {safe}
          %
          {' '}
          ·
          {' '}
          {label}
        </b>
      </div>
      <div className="cs-bar">
        <motion.div
          className="cs-bar-fill"
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
              className="cs-success"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3, ease: ENTER_EASE }}
              role="status"
              aria-live="polite"
            >
              <span className="cs-check" aria-hidden="true">
                <Check strokeWidth={3} />
              </span>
              You're on the list — we'll send a hard-hat heads-up the moment it's live.
            </motion.div>
          )
        : (
            <motion.div
              key="form"
              className="cs-form-block"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <form className="cs-form" onSubmit={submit} noValidate>
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
                className={cn('cs-hint', state === 'error' && 'cs-hint-err')}
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

function ConstructionScene() {
  return (
    <div
      className="cs-scaler"
      role="img"
      aria-label="A small construction scene: a tower crane lowering a content block onto a webpage card while an excavator digs at the base."
    >
      <div className="cs-stage">
        <div className="cs-ground" />
        <div className="cs-mound" />

        <div className="cs-page">
          <div className="cs-page-bar">
            <span className="cs-dot cs-dot-r" />
            <span className="cs-dot cs-dot-y" />
            <span className="cs-dot cs-dot-g" />
            <span className="cs-page-url" />
          </div>
          <div className="cs-page-body">
            <div className="cs-blk cs-blk-solid cs-h-hero" />
            <div className="cs-row">
              <div className="cs-blk cs-blk-solid cs-thumb" />
              <div className="cs-col">
                <div className="cs-blk cs-blk-solid cs-h-line cs-w-90" />
                <div className="cs-blk cs-blk-solid cs-h-line cs-w-70" />
              </div>
            </div>
            <div className="cs-blk cs-blk-ghost cs-h-line cs-w-90 cs-landing">
              <span className="cs-drop-target" />
            </div>
            <div className="cs-blk cs-blk-ghost cs-h-line cs-w-70" />
          </div>
        </div>

        <div className="cs-dust cs-dust-land1" />
        <div className="cs-dust cs-dust-land2" />
        <div className="cs-dust cs-dust-land3" />

        <div className="cs-crane">
          <div className="cs-mast" />
          <div className="cs-apex" />
          <div className="cs-counter-jib" />
          <div className="cs-counterweight" />
          <div className="cs-jib" />
          <div className="cs-cab" />
          <div className="cs-rig">
            <div className="cs-trolley" />
            <div className="cs-cable" />
            <div className="cs-hook" />
            <div className="cs-load" />
          </div>
        </div>

        <div className="cs-dozer">
          <div className="cs-tracks" />
          <div className="cs-cabin" />
          <div className="cs-boom-pivot">
            <div className="cs-boom">
              <div className="cs-stick">
                <div className="cs-bucket" />
              </div>
            </div>
          </div>
        </div>

        <div className="cs-dust cs-dust-d1" />
        <div className="cs-dust cs-dust-d2" />
        <div className="cs-dust cs-dust-d3" />
        <div className="cs-mote cs-mote-m1" />
        <div className="cs-mote cs-mote-m2" />
        <div className="cs-mote cs-mote-m3" />
      </div>
    </div>
  )
}
