'use client'

import type { Trade } from '@/shared/modules/construction/sources/notion/trades/schema'
import Image from 'next/image'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { selectStageMedia } from '@/features/meeting-flow/lib/select-stage-media'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { cn } from '@/shared/lib/utils'

interface TradeThumbProps {
  trade: Trade | undefined
  className?: string
}

/** The trade's first photo as a small square; a quiet muted tile when it has none. Decorative: the label beside it names the trade. */
export function TradeThumb({ trade, className }: TradeThumbProps) {
  const { projects } = useTradeCatalogContext()
  const media = trade ? selectStageMedia(trade, [], projects)[0] : undefined

  return (
    <span aria-hidden className={cn('relative block size-10 shrink-0 overflow-hidden rounded-[3px] bg-muted', className)}>
      {media?.kind === 'project' && <OptimizedImage alt="" fill file={media.file} sizes="48px" />}
      {media?.kind === 'curated' && <Image alt="" className="object-cover" fill sizes="48px" src={media.photo.src} />}
    </span>
  )
}
