import type { ReceiptRow } from '@/features/calculators/remodel-roi-calculator/types'

import { TONE_TEXT_CLASSES } from '@/features/calculators/remodel-roi-calculator/constants/story-classes'
import { SourceTag } from '@/features/calculators/remodel-roi-calculator/ui/components/story/source-tag'
import { BlockEyebrow } from '@/shared/components/block/block-eyebrow'
import { cn } from '@/shared/lib/utils'

interface Props {
  rows: ReceiptRow[]
}

export function Receipt({ rows }: Props) {
  if (!rows.length) {
    return null
  }
  return (
    <div className="grid border-t">
      {rows.map(row => row.kind === 'heading'
        ? <BlockEyebrow className="pt-4 pb-1" key={`h-${row.label}`}>{row.label}</BlockEyebrow>
        : (
            <div className={cn('grid grid-cols-[1.25rem_minmax(0,1fr)_auto_7rem] items-baseline gap-2.5 border-b border-dashed py-2 text-sm', row.strong && 'border-solid font-bold')} key={`${row.op ?? ''}${row.label}`}>
              <span className="text-center text-muted-foreground">{row.op}</span>
              <span>
                {row.label}
                {row.note && <small className="block text-xs font-normal text-muted-foreground">{row.note}</small>}
              </span>
              <span className={cn('whitespace-nowrap text-right font-bold tabular-nums', row.strong && TONE_TEXT_CLASSES[row.strong])}>{row.value}</span>
              <SourceTag tag={row.tag} />
            </div>
          ))}
    </div>
  )
}
