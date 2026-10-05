import { ZoomInIcon } from 'lucide-react'

interface TapCueProps {
  label: string
}

/**
 * The visible "Tap to view" on a document the homeowner can open (U11). Decorative: it sits
 * inside the opener's tap target, and every opener carries its own accessible name.
 */
export function TapCue({ label }: TapCueProps) {
  return (
    <span aria-hidden className="inline-flex items-center gap-2 rounded-md bg-(--presentation-ground)/90 px-3 py-1.5 font-sans text-presentation-label font-semibold text-white">
      <ZoomInIcon className="size-[1.1em] shrink-0" />
      {label}
    </span>
  )
}
