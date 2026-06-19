import type { LocationStep, StepProps } from '@/shared/domains/funnels/types'
import { MapPin } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { FUNNEL_TRANSITION } from '@/shared/domains/funnels/constants/funnel-motion'
import { classifyZip, resolveZip } from '@/shared/domains/funnels/lib/resolve-zip'
import { ZipCheckProgress } from '@/shared/domains/funnels/ui/steps/zip-check-progress'

type Phase = 'input' | 'checking' | 'qualified' | 'out-of-area'
const CHECK_STEPS = ['Locating your ZIP…', 'Checking service radius…', 'Confirming crew availability…', 'Reserving your area…']
const STEP_MS = 450
const MIN_CHECKING_MS = CHECK_STEPS.length * STEP_MS // 1800

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export function LocationStepView({ content, value, setValue }: StepProps<LocationStep>) {
  // Persistence (#5): if this step was already answered (reached via Back),
  // mount directly in the qualified phase with the stored ZIP.
  const [zip, setZip] = useState(value?.zip ?? '')
  const [phase, setPhase] = useState<Phase>(value?.zip ? 'qualified' : 'input')
  const reduceMotion = useReducedMotion()

  async function handleSubmit() {
    if (!/^\d{5}$/.test(zip)) {
      return
    }
    if (classifyZip(zip) !== 'in-area') {
      setPhase('out-of-area')
      return
    }
    setPhase('checking')
    // Anticipation beat (#4): local ZIPs resolve instantly — make qualifying breathe.
    const [resolved] = await Promise.all([resolveZip(zip), delay(MIN_CHECKING_MS)])
    setValue({
      zip,
      city: resolved?.city ?? '',
      state: resolved?.state ?? 'CA',
      county: resolved?.county ?? null,
    })
    setPhase('qualified')
  }

  if (phase === 'checking') {
    return <ZipCheckProgress steps={CHECK_STEPS} stepMs={STEP_MS} />
  }

  if (phase === 'qualified') {
    const place = [value?.city, value?.county ? `${value.county} County` : null].filter(Boolean).join(', ')
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center" aria-live="polite">
        <p className="text-foreground text-xl font-semibold">
          {content.qualifiesLabel ?? '✓ Great news — your area qualifies.'}
        </p>
        {place
          ? (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, scale: 0.9, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={FUNNEL_TRANSITION}
                className="border-primary/30 bg-primary/5 inline-flex items-center gap-2 rounded-full border px-4 py-2"
              >
                <MapPin className="text-primary size-4" aria-hidden="true" />
                <span className="text-foreground text-sm font-medium">{place}</span>
              </motion.div>
            )
          : null}
        {/* Persisted ZIP is editable: drop back to input (current ZIP pre-filled)
            so a different area can be checked. Re-checking overwrites the stored
            value. Secondary action — deliberately not the primary color. */}
        <Button variant="ghost" size="sm" onClick={() => setPhase('input')} className="text-muted-foreground">
          Check a different ZIP
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{content.title}</h2>
        {content.subtitle ? <p className="text-muted-foreground mt-1">{content.subtitle}</p> : null}
      </div>
      <Input
        inputMode="numeric"
        maxLength={5}
        placeholder="ZIP code"
        value={zip}
        onChange={(e) => {
          setZip(e.target.value.replace(/\D/g, ''))
          if (phase === 'out-of-area') {
            setPhase('input')
          }
        }}
        className="mx-auto max-w-xs text-center text-lg"
      />
      {phase === 'out-of-area'
        ? <p aria-live="polite" className="text-muted-foreground text-center text-sm">{content.outOfAreaLabel ?? 'We don\'t serve that area yet — double-check your ZIP.'}</p>
        : null}
      <Button size="lg" disabled={!/^\d{5}$/.test(zip)} onClick={handleSubmit}>
        {content.inputCta ?? 'Check my area'}
      </Button>
    </div>
  )
}

/** Importable prebuilt step (Seam A). Spread + override `content` to customize per funnel. */
export const ZIP_STEP: LocationStep = {
  id: 'location',
  kind: 'location',
  content: {
    title: 'Where is your home?',
    subtitle: 'We select Showcase homes by area.',
    inputCta: 'Check my area',
    checkingLabel: 'Checking availability in {zip}…',
    qualifiesLabel: '✓ Great news — your area qualifies. Limited spots remain.',
    outOfAreaLabel: 'We don\'t serve that area yet — double-check your ZIP.',
  },
}
