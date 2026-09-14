import type { PointMedia } from '@/features/meeting-flow/types'
import Image from 'next/image'
import { Scrim } from '@/features/meeting-flow/ui/components/presentation/scrim'
import { SectionImage } from '@/features/meeting-flow/ui/components/presentation/section-image'

interface PointMediaLayerProps {
  media: PointMedia
}

/**
 * Full-bleed backdrop for a point section. `photo` sits under the radial scrim;
 * `pair` splits before/after (stacked below lg, side by side on lg+).
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
