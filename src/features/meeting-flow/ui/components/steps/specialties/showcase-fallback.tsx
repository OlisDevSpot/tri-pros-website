import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { Decor } from '@/shared/components/decor/decor'

interface ShowcaseFallbackProps {
  scopeNames: string[]
}

/**
 * A trade with no owned photo: the blueprint decor (anchored top-right, DESIGN.md Atmosphere) and what the
 * trade includes. Never an empty frame. The decor tokens are defined for the marketing theme only, so they
 * are set here for the app theme.
 */
export function ShowcaseFallback({ scopeNames }: ShowcaseFallbackProps) {
  return (
    <div className="absolute inset-0 isolate flex flex-col justify-start overflow-hidden bg-white/[0.04] p-6 [--decor-gradient-alpha:0.34] [--decor-stroke:#03afed] @4xl/specialties:justify-end @4xl/specialties:px-10 @4xl/specialties:pb-8">
      <Decor className="z-0" rings={9} shape="arc" />
      <div className="relative z-10 hidden max-w-[56ch] flex-col gap-2 @4xl/specialties:flex">
        <p className="font-sans text-xs font-semibold tracking-[0.06em] text-(--presentation-accent) uppercase">{SPECIALTIES_COPY.showcase.included}</p>
        {scopeNames.length > 0 && (
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-base font-semibold text-white">
            {scopeNames.map(name => <li key={name}>{name}</li>)}
          </ul>
        )}
      </div>
    </div>
  )
}
