'use client'

import { ArrowLeft, ArrowRight, Check, CircleCheck, Pencil, Phone, RotateCcw, Sparkles, Star } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { contactInfo } from '@/shared/constants/company/contact-info'
import { FUNNEL_QUESTION_MAX_W, FUNNEL_RAIL_MAX_W } from '@/shared/domains/funnels/constants/funnel-layout'
import { OPTION_ICONS } from '@/shared/domains/funnels/constants/option-assets'
import { ConfirmationTimeline } from '@/shared/domains/funnels/ui/steps/confirmation-timeline'
import { cn } from '@/shared/lib/utils'

/*
 * PREVIEW SCRATCH — Redesigned funnel CONFIRMATION page (proposal, not production).
 *
 * Demonstrates the three asks: (1) a grouped, on-brand SUMMARY of every answer,
 * (2) "edit a field" via JUMP-BACK into the actual step, (3) reset / start over.
 *
 * Decisions baked in (per review): summary sits LOW (after the what's-next
 * timeline); edit jumps back into the step then returns; name/phone editable too.
 * State is LOCAL ONLY — no lead writes. The real build adds a goTo() to the
 * engine + a backend update path; this page is purely the look & feel to approve.
 */

// ── Real option data, lifted from the kitchens spec (faithful labels/assets) ──

interface Opt { label: string, img?: string, icon?: string }
interface CardField { title: string, ids: string[], opts: Record<string, Opt> }

const CARD_OPTIONS: Record<string, CardField> = {
  layout: {
    title: 'Which best describes your kitchen?',
    ids: ['l-shape', 'u-shape', 'galley', 'island', 'open', 'not-sure'],
    opts: {
      'l-shape': { label: 'L-shaped', img: '/funnels/kitchens/layout/l-shape.webp' },
      'u-shape': { label: 'U-shaped', img: '/funnels/kitchens/layout/u-shape.webp' },
      'galley': { label: 'Galley', img: '/funnels/kitchens/layout/galley.webp' },
      'island': { label: 'Has an island', img: '/funnels/kitchens/layout/island.webp' },
      'open': { label: 'Open-concept', icon: 'open' },
      'not-sure': { label: 'Not sure', icon: 'not-sure' },
    },
  },
  age: {
    title: 'How old is your kitchen?',
    ids: ['0-5', '5-15', '15-plus', 'original'],
    opts: {
      '0-5': { label: '0–5 years', img: '/funnels/kitchens/age/0-5.webp' },
      '5-15': { label: '5–15 years', img: '/funnels/kitchens/age/5-15.webp' },
      '15-plus': { label: '15+ years', img: '/funnels/kitchens/age/15-plus.webp' },
      'original': { label: 'Original / never renovated', img: '/funnels/kitchens/age/original.webp' },
    },
  },
  scope: {
    title: 'What are you picturing?',
    ids: ['full-gut', 'cabinets-counters', 'refresh', 'not-sure'],
    opts: {
      'full-gut': { label: 'Full gut remodel', img: '/funnels/kitchens/scope/full-gut.webp' },
      'cabinets-counters': { label: 'Cabinets + counters', img: '/funnels/kitchens/scope/cabinets-counters.webp' },
      'refresh': { label: 'Cosmetic refresh', img: '/funnels/kitchens/scope/refresh.webp' },
      'not-sure': { label: 'Not sure yet', img: '/funnels/kitchens/scope/not-sure.webp' },
    },
  },
  timeline: {
    title: 'When would you want to start?',
    ids: ['asap', '1-3', '3-6', 'exploring'],
    opts: {
      'asap': { label: 'ASAP' },
      '1-3': { label: '1–3 months' },
      '3-6': { label: '3–6 months' },
      'exploring': { label: 'Just exploring' },
    },
  },
  homeType: {
    title: 'What kind of home is it?',
    ids: ['single-family', 'condo', 'mobile-home', 'commercial'],
    opts: {
      'single-family': { label: 'Single-family', img: '/funnels/common/home-type/single-family.webp' },
      'condo': { label: 'Condo', img: '/funnels/common/home-type/condo.webp' },
      'mobile-home': { label: 'Mobile home', img: '/funnels/common/home-type/mobile-home.webp' },
      'commercial': { label: 'Commercial', img: '/funnels/common/home-type/commercial.webp' },
    },
  },
  ownership: {
    title: 'Do you own or rent your home?',
    ids: ['own', 'rent'],
    opts: { own: { label: 'I own my home' }, rent: { label: 'I rent' } },
  },
}

// ── Mock answer set (a completed kitchens funnel) ──

interface Answers {
  layout: string
  age: string
  scope: string
  timeline: string
  homeType: string
  ownership: string
  address: string
  firstName: string
  lastName: string
  phone: string
}

const INITIAL_ANSWERS: Answers = {
  layout: 'l-shape',
  age: '15-plus',
  scope: 'full-gut',
  timeline: 'asap',
  homeType: 'single-family',
  ownership: 'own',
  address: '1240 N Harbor Blvd, Anaheim, CA 92805',
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '(714) 555-0123',
}

// Which fields edit as a text input (vs a card grid).
type TextField = 'name' | 'address'
type EditField = keyof typeof CARD_OPTIONS | TextField

const ROW_LABEL: Record<EditField, string> = {
  layout: 'Layout',
  age: 'Kitchen age',
  scope: 'Scope',
  timeline: 'Timeline',
  homeType: 'Property type',
  ownership: 'Ownership',
  address: 'Address',
  name: 'Name & phone',
}

const SECTIONS: { eyebrow: string, rows: EditField[] }[] = [
  { eyebrow: 'Your project', rows: ['layout', 'age', 'scope', 'timeline'] },
  { eyebrow: 'Your home', rows: ['homeType', 'ownership', 'address'] },
  { eyebrow: 'Your details', rows: ['name'] },
]

const WHAT_NEXT = [
  'We review your home against this round\'s Showcase criteria.',
  'A Tri Pros specialist calls within 24 hours to confirm fit.',
  'If selected, we schedule your in-home design visit.',
]

const PHONE = contactInfo.find(i => i.accessor === 'phone')!.value
const CONFIRM_HERO_IMG = '/portfolio-photos/modern-kitchen-1.jpeg'

function resolveValue(field: EditField, a: Answers): { value: string, img?: string, icon?: string } {
  if (field === 'name')
    return { value: `${a.firstName} ${a.lastName} · ${a.phone}` }
  if (field === 'address')
    return { value: a.address }
  const cfg = CARD_OPTIONS[field]
  const opt = cfg.opts[a[field as keyof Answers]]
  return { value: opt?.label ?? '—', img: opt?.img, icon: opt?.icon }
}

// ── Page ──

export default function TestPage() {
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS)
  const [editing, setEditing] = useState<EditField | null>(null)
  const reduce = useReducedMotion()

  return (
    // Mirrors the real funnel rail (funnel-engine.tsx): the 5xl content rail with
    // the px-5 gutter + sticky-header offset. Focused content constrains internally.
    <main className="funnel-light min-h-dvh w-full bg-background">
      <div className={cn('mx-auto flex w-full flex-col gap-8 px-5 pt-8 pb-10', FUNNEL_RAIL_MAX_W)}>
        <PrototypeBanner />
        <AnimatePresence mode="wait">
          {editing
            ? (
                <EditorView
                  key={`edit-${editing}`}
                  field={editing}
                  answers={answers}
                  reduce={reduce}
                  onSave={(next) => {
                    setAnswers(next)
                    setEditing(null)
                  }}
                  onBack={() => setEditing(null)}
                />
              )
            : (
                <motion.div
                  key="confirmation"
                  initial={reduce ? false : { opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? undefined : { opacity: 0, x: -12 }}
                  transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                >
                  <ConfirmationView
                    answers={answers}
                    reduce={reduce}
                    onEdit={setEditing}
                    onReset={() => setAnswers(INITIAL_ANSWERS)}
                  />
                </motion.div>
              )}
        </AnimatePresence>
      </div>
    </main>
  )
}

function PrototypeBanner() {
  return (
    <div className="mb-6 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3.5 py-2.5">
      <p className="text-xs leading-relaxed text-foreground/80">
        <span className="font-semibold text-foreground">Prototype</span>
        {' · '}
        Redesigned confirmation page. Tap any
        {' '}
        <Pencil className="inline size-3" aria-hidden />
        {' '}
        to jump back into that step and edit it. Local only — nothing is saved.
      </p>
    </div>
  )
}

// ── Confirmation view (celebratory header + CTAs primary, summary low) ──

function ConfirmationView({ answers, reduce, onEdit, onReset }: {
  answers: Answers
  reduce: boolean | null
  onEdit: (f: EditField) => void
  onReset: () => void
}) {
  function entrance(delay: number) {
    if (reduce)
      return {}
    return {
      initial: { opacity: 0, y: 22 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] as const, delay },
    }
  }

  return (
    // Fills the 5xl rail. The header + CTAs stay focused (question rail); the
    // timeline+summary block goes wide so it can split into two columns on desktop.
    <div className="flex w-full flex-col items-center gap-8 py-6 text-center">
      {/* Top section — a defined, hero-inspired panel: the brand photo runs full-bleed
          behind the same frosted warm plate as the landing hero (--hero-plate / ring /
          --shadow-hero), bookending the funnel. Holds the success lockup + CTAs. */}
      <motion.section
        className="@container relative isolate w-full overflow-hidden rounded-2xl shadow-(--shadow-hero)"
        {...entrance(0)}
      >
        <Image
          src={CONFIRM_HERO_IMG}
          alt=""
          fill
          priority
          sizes="(max-width: 640px) 100vw, 1024px"
          className="-z-10 object-cover object-center"
        />
        <div className="m-3 flex flex-col items-center gap-6 rounded-2xl bg-(--hero-plate) px-6 py-9 text-center ring-1 ring-(--hero-plate-ring) backdrop-blur-lg @3xl:m-4 @3xl:px-11 @3xl:py-12">
          <span className="bg-success/10 text-success ring-success/20 flex size-16 items-center justify-center rounded-full ring-1">
            <CircleCheck className="size-9" aria-hidden />
          </span>
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-foreground text-balance font-serif text-3xl font-bold tracking-tight @3xl:text-4xl">
              You&apos;re on the Showcase list.
            </h2>
            <p className="max-w-(--measure-prose) text-balance text-lg font-medium text-(--hero-ink-soft)">
              We review every home for fit and call within 24 hours to confirm your spot.
            </p>
          </div>
          <div className="flex w-full max-w-md flex-col gap-3">
            <Button asChild size="lg" className="h-14 gap-2 text-base font-semibold shadow-sm">
              <a href={`tel:${PHONE.replace(/\D/g, '')}`}>
                <Phone className="size-4" aria-hidden />
                {`Call ${PHONE}`}
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 text-base">
              <a href="#" rel="noopener noreferrer">See our work</a>
            </Button>
          </div>
        </div>
      </motion.section>

      {/* What happens next + summary — ONE container. Mobile: stacked, steps first
          then summary. Desktop: a 5-col grid (grid cells stretch to equal height,
          which fixes the height mismatch) — summary LEFT (3 cols), steps RIGHT (2). */}
      <motion.div className="flex w-full flex-col gap-4 md:grid md:grid-cols-5 md:gap-6" {...entrance(0.24)}>
        {/* Steps + reassurance. On desktop the grid stretches both cells to equal
            height; justify-between pins the steps to the top and the reassurance to
            the bottom (header-content + footer), so it fills the height — no void. */}
        <div className="border-border bg-card flex flex-col justify-between gap-5 rounded-2xl border p-6 text-left md:order-last md:col-span-2">
          <div className="flex flex-col gap-4">
            <h3 className="text-foreground text-base font-semibold">What happens next</h3>
            <ConfirmationTimeline steps={WHAT_NEXT} />
          </div>
          <div className="border-border hidden flex-col gap-3 border-t pt-5 md:flex">
            <p className="text-foreground flex items-center gap-2 text-sm font-medium">
              <Sparkles className="text-primary size-4 shrink-0" aria-hidden />
              Spots are limited — selected homes are confirmed first-come.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="border-border bg-background text-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold">
                <Star className="size-3.5 fill-amber-500 text-amber-500" aria-hidden />
                4.9 Google
              </span>
              <span className="border-border bg-background text-foreground inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold">
                BBB A+
              </span>
            </div>
          </div>
        </div>
        <div className="w-full md:order-first md:col-span-3">
          <SummaryCard answers={answers} onEdit={onEdit} onReset={onReset} />
        </div>
      </motion.div>
    </div>
  )
}

function SummaryCard({ answers, onEdit, onReset }: {
  answers: Answers
  onEdit: (f: EditField) => void
  onReset: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <section className="border-border bg-card w-full overflow-hidden rounded-2xl border text-left">
      <header className="flex items-center justify-between gap-2 px-5 pt-4 pb-3">
        <div>
          <h3 className="text-foreground text-base font-semibold">Here&apos;s what you told us</h3>
          <p className="text-muted-foreground text-xs">Need to fix something? Tap edit on any line.</p>
        </div>
      </header>

      <div className="flex flex-col">
        {SECTIONS.map(section => (
          <div key={section.eyebrow} className="border-border border-t">
            {/* Quiet data-group label — reuses the funnel eyebrow tokens (--fs-eyebrow /
                --tracking-eyebrow) in a muted tone rather than the accent BlockEyebrow. */}
            <p className="text-muted-foreground bg-muted/40 px-5 py-1.5 font-bold uppercase text-(length:--fs-eyebrow) tracking-(--tracking-eyebrow)">
              {section.eyebrow}
            </p>
            {section.rows.map(field => (
              <SummaryRow key={field} field={field} answers={answers} onEdit={() => onEdit(field)} />
            ))}
          </div>
        ))}
      </div>

      {/* Reset — low emphasis, confirm-gated, separated from primary actions */}
      <footer className="border-border border-t px-5 py-3">
        {confirming
          ? (
              <div className="flex flex-col gap-2.5">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Start the questionnaire over? This clears these answers on your device. We already
                  have your request — your spot is safe.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      onReset()
                      setConfirming(false)
                    }}
                  >
                    Yes, start over
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )
          : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="text-muted-foreground hover:text-destructive inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Start over
              </button>
            )}
      </footer>
    </section>
  )
}

function SummaryRow({ field, answers, onEdit }: { field: EditField, answers: Answers, onEdit: () => void }) {
  const { value, img, icon } = resolveValue(field, answers)
  const Icon = icon ? OPTION_ICONS[icon] : null

  return (
    <div className="border-border flex items-center gap-3 border-t px-5 py-2.5 first:border-t-0">
      {img
        ? (
            <span className="border-border relative size-11 shrink-0 overflow-hidden rounded-md border">
              <Image src={img} alt="" fill sizes="44px" className="object-cover" />
            </span>
          )
        : Icon
          ? (
              <span className="bg-muted/40 border-border flex size-11 shrink-0 items-center justify-center rounded-md border">
                <Icon className="text-foreground size-6" />
              </span>
            )
          : null}
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground text-xs">{ROW_LABEL[field]}</div>
        <div className="text-foreground truncate text-sm font-medium tabular-nums">{value}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${ROW_LABEL[field]}`}
        className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-11 shrink-0 items-center justify-center rounded-md transition-colors"
      >
        <Pencil className="size-4" aria-hidden />
      </button>
    </div>
  )
}

// ── Editor view (the "jump back into the step" surface) ──

function EditorView({ field, answers, reduce, onSave, onBack }: {
  field: EditField
  answers: Answers
  reduce: boolean | null
  onSave: (next: Answers) => void
  onBack: () => void
}) {
  const [draft, setDraft] = useState<Answers>(answers)
  const isCard = field in CARD_OPTIONS

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduce ? undefined : { opacity: 0, x: 16 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      className={cn('mx-auto flex w-full flex-col gap-6 py-6', FUNNEL_QUESTION_MAX_W)}
    >
      <button
        type="button"
        onClick={onBack}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 self-start text-sm font-medium transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to summary
      </button>

      <p className="text-muted-foreground text-center font-bold uppercase text-(length:--fs-eyebrow) tracking-(--tracking-eyebrow)">
        Editing your answer
      </p>

      {isCard
        ? <CardEditor field={field as keyof typeof CARD_OPTIONS} draft={draft} reduce={reduce} setDraft={setDraft} />
        : <TextEditor field={field as TextField} draft={draft} setDraft={setDraft} />}

      <Button size="lg" className="gap-2" onClick={() => onSave(draft)}>
        Save & return
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </motion.div>
  )
}

function CardEditor({ field, draft, reduce, setDraft }: {
  field: keyof typeof CARD_OPTIONS
  draft: Answers
  reduce: boolean | null
  setDraft: (a: Answers) => void
}) {
  const cfg = CARD_OPTIONS[field]
  const current = draft[field as keyof Answers]

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-foreground text-center text-2xl font-semibold">{cfg.title}</h2>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {cfg.ids.map((id) => {
          const opt = cfg.opts[id]
          const selected = current === id
          const Icon = opt.icon ? OPTION_ICONS[opt.icon] : null
          return (
            <motion.button
              key={id}
              type="button"
              whileTap={reduce ? undefined : { scale: 0.97 }}
              onClick={() => setDraft({ ...draft, [field]: id })}
              className={cn(
                'flex flex-col items-center overflow-hidden rounded-lg border-2 text-center shadow-sm transition-colors touch-manipulation',
                selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60',
              )}
            >
              {(opt.img || Icon)
                ? (
                    <div className="bg-muted/40 flex aspect-video w-full items-center justify-center">
                      {opt.img
                        ? <Image src={opt.img} alt={opt.label} width={600} height={282} sizes="(max-width: 640px) 45vw, 280px" className="h-full w-full object-cover object-center" />
                        : Icon ? <Icon className="text-foreground size-8 sm:size-10" /> : null}
                    </div>
                  )
                : null}
              <span className="text-foreground block p-2 text-sm font-medium">{opt.label}</span>
            </motion.button>
          )
        })}
      </div>
      <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-sm">
        <Check className="size-3.5" aria-hidden />
        Pick a different option, then save.
      </p>
    </div>
  )
}

function TextEditor({ field, draft, setDraft }: { field: TextField, draft: Answers, setDraft: (a: Answers) => void }) {
  if (field === 'address') {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-foreground text-center text-2xl font-semibold">What&apos;s the property address?</h2>
        <label className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-sm font-medium">Address</span>
          <Input value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} />
        </label>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-foreground text-center text-2xl font-semibold">Your contact details</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-sm font-medium">First name</span>
          <Input value={draft.firstName} onChange={e => setDraft({ ...draft, firstName: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-sm font-medium">Last name</span>
          <Input value={draft.lastName} onChange={e => setDraft({ ...draft, lastName: e.target.value })} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-sm font-medium">Phone</span>
        <Input type="tel" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} />
      </label>
    </div>
  )
}
