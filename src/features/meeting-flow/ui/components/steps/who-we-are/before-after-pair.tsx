import type { BeforeAfterMedia } from '@/features/meeting-flow/types'
import Image from 'next/image'

interface BeforeAfterPairProps {
  media: BeforeAfterMedia
}

/**
 * The same room before and after, side by side at the photos' own proportions so nothing
 * is cropped (U12), centred in the media row: the pair holds the row the way the agent's
 * card holds its own, instead of sinking to the copy under an empty band.
 */
export function BeforeAfterPair({ media }: BeforeAfterPairProps) {
  const aspectRatio = `${media.width} / ${media.height}`
  return (
    <div className="absolute inset-0 grid grid-cols-2 content-center gap-[2cqw]">
      <figure className="relative min-h-0 overflow-hidden rounded-md" style={{ aspectRatio }}>
        <Image alt={`${media.alt}, before`} className="object-cover" draggable={false} fill sizes="(min-width: 1024px) 30vw, 50vw" src={media.before} />
        <figcaption className="absolute top-presentation-tight left-presentation-tight rounded-sm bg-black/60 px-2 py-0.5 font-sans text-presentation-label font-semibold">
          Before
        </figcaption>
      </figure>
      <figure className="relative min-h-0 overflow-hidden rounded-md" style={{ aspectRatio }}>
        <Image alt={`${media.alt}, after`} className="object-cover" draggable={false} fill sizes="(min-width: 1024px) 30vw, 50vw" src={media.after} />
        <figcaption className="absolute top-presentation-tight left-presentation-tight rounded-sm bg-white/90 px-2 py-0.5 font-sans text-presentation-label font-semibold text-(--presentation-ground)">
          After
        </figcaption>
      </figure>
    </div>
  )
}
