import type { LocationStep, StepProps } from '@/shared/domains/funnels/types'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { resolveZip } from '@/shared/domains/funnels/lib/resolve-zip'

type Phase = 'input' | 'checking' | 'qualified'

export function LocationStepView({ content, setValue, advance, back, isFirst }: StepProps<LocationStep>) {
  const [zip, setZip] = useState('')
  const [phase, setPhase] = useState<Phase>('input')

  async function handleSubmit() {
    if (!/^\d{5}$/.test(zip)) {
      return
    }
    setPhase('checking')
    const resolved = await resolveZip(zip)
    // Composite answer — one slot, written once. No setAnswers.
    setValue({
      zip,
      city: resolved?.city ?? '',
      state: resolved?.state ?? 'CA',
      county: resolved?.county ?? null,
    })
    setPhase('qualified')
  }

  if (phase === 'input') {
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
          onChange={e => setZip(e.target.value.replace(/\D/g, ''))}
          className="mx-auto max-w-xs text-center text-lg"
        />
        <Button size="lg" disabled={!/^\d{5}$/.test(zip)} onClick={handleSubmit}>
          {content.cta ?? 'Check my area'}
        </Button>
        {!isFirst ? <Button variant="ghost" onClick={back}>← Back</Button> : null}
      </div>
    )
  }

  if (phase === 'checking') {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
        <p className="text-muted-foreground">{(content.checkingLabel ?? 'Checking availability in {zip}…').replace('{zip}', zip)}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <p className="text-primary text-xl font-semibold">
        {content.qualifiesLabel ?? '✓ Great news — your area qualifies.'}
      </p>
      {/* Plan 2c replaces this with the stylized SVG region reveal. */}
      <Button size="lg" onClick={advance}>{content.cta ?? 'Continue'}</Button>
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
    cta: 'Check my area',
    checkingLabel: 'Checking availability in {zip}…',
    qualifiesLabel: '✓ Great news — your area qualifies. Limited spots remain.',
  },
}
