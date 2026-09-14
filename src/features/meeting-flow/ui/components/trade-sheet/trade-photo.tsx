import type { TradePhoto as TradePhotoData } from '@/features/meeting-flow/types'
import Image from 'next/image'
import { PlaceholderSlot } from '@/features/meeting-flow/ui/components/steps/who-we-are/placeholder-slot'

interface TradePhotoProps {
  /** Trade name, shown inside the placeholder when there is no photo. */
  label: string
  photo?: TradePhotoData
}

/**
 * 16:10 frame. A size container so the placeholder's `cq*` units resolve against it. No shadow here, so the clip is allowed.
 * `PlaceholderSlot` is drawn for the dark presentation ground; the class override recolors it for the app surface.
 */
export function TradePhoto({ label, photo }: TradePhotoProps) {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted [container-type:size]">
      {photo
        ? <Image alt={photo.alt} className="object-cover" fill sizes="(min-width: 1024px) 36rem, 100vw" src={photo.src} />
        : <PlaceholderSlot className="absolute inset-0 rounded-lg border-muted-foreground/30 text-muted-foreground" label={label} />}
    </div>
  )
}
