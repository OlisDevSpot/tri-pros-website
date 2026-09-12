import type { PointMedia } from '@/features/meeting-flow/types'
import Image from 'next/image'
import { Scrim } from '@/features/meeting-flow/ui/components/presentation/scrim'
import { SectionImage } from '@/features/meeting-flow/ui/components/presentation/section-image'
import { PlaceholderSlot } from '@/features/meeting-flow/ui/components/steps/who-we-are/placeholder-slot'

interface PointMediaLayerProps {
  media: PointMedia
}

/**
 * Media for a point section, by kind. `photo` is full bleed under the radial scrim;
 * `portrait` takes the right 46% on lg+ (top 62% below) with a fade into the ground;
 * `pair` splits before/after; `placeholder` is the labeled slot.
 */
export function PointMediaLayer({ media }: PointMediaLayerProps) {
  if (media.type === 'photo') {
    return (
      <>
        <SectionImage alt={media.alt} src={media.src} />
        <Scrim />
      </>
    )
  }

  if (media.type === 'portrait') {
    return (
      <>
        <SectionImage
          alt={media.alt}
          className="inset-auto top-0 right-0 h-[62%] w-full lg:h-full lg:w-[46%]"
          imageClassName="object-[50%_15%]"
          src={media.src}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{ background: 'linear-gradient(to top, var(--presentation-ground) 40%, color-mix(in oklab, var(--presentation-ground) 50%, transparent) 55%, transparent 72%)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden lg:block"
          style={{ background: 'linear-gradient(90deg, var(--presentation-ground) 48%, color-mix(in oklab, var(--presentation-ground) 60%, transparent) 58%, transparent 78%)' }}
        />
      </>
    )
  }

  if (media.type === 'pair') {
    return (
      <>
        <div className="absolute top-0 left-0 h-1/2 w-full overflow-hidden lg:h-full lg:w-1/2">
          <Image alt={`${media.alt}, before`} className="object-cover" draggable={false} fill sizes="(min-width: 1024px) 31vw, 100vw" src={media.before} />
          <span className="absolute top-[3cqh] left-[3cqw] rounded-[3px] bg-black/55 px-[0.7em] py-[0.3em] font-sans text-[max(2.2cqw,0.75rem)] font-semibold lg:text-[max(1.4cqw,0.75rem)]">
            Before
          </span>
        </div>
        <div className="absolute bottom-0 left-0 h-1/2 w-full overflow-hidden lg:top-0 lg:right-0 lg:left-auto lg:h-full lg:w-1/2">
          <Image alt={`${media.alt}, after`} className="object-cover" draggable={false} fill sizes="(min-width: 1024px) 31vw, 100vw" src={media.after} />
          <span className="absolute top-[3cqh] left-[3cqw] rounded-[3px] bg-white/90 px-[0.7em] py-[0.3em] font-sans text-[max(2.2cqw,0.75rem)] font-semibold text-(--presentation-ground) lg:text-[max(1.4cqw,0.75rem)]">
            After
          </span>
        </div>
        <div aria-hidden className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-white/80 lg:inset-y-0 lg:left-1/2 lg:h-auto lg:w-0.5 lg:translate-x-[-50%] lg:translate-y-0" />
        <Scrim />
      </>
    )
  }

  return <PlaceholderSlot label={media.label} />
}
