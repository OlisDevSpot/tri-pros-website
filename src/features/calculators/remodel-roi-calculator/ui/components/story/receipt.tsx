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
      {rows.map((row, index) => row.kind === 'heading'
        // eslint-disable-next-line react/no-array-index-key -- rows are data and never reorder, and labels repeat once per trade
        ? <BlockEyebrow className="pt-4 pb-1" key={index}>{row.label}</BlockEyebrow>
        : (
            <div
              className={cn('grid grid-cols-[1.25rem_minmax(0,1fr)_auto_7rem] items-baseline gap-2.5 border-b border-dashed py-2 text-sm @max-md/story:grid-cols-[1.25rem_minmax(0,1fr)_auto] @max-md/story:gap-y-1', row.strong && 'border-solid font-bold')}
              // eslint-disable-next-line react/no-array-index-key -- rows are data and never reorder, and labels repeat once per trade
              key={index}
            >
              <span className="text-center text-muted-foreground">{row.op}</span>
              <span>
                {row.label}
                {row.note && <small className="block text-xs font-normal text-muted-foreground">{row.note}</small>}
              </span>
              <span className={cn('whitespace-nowrap text-right font-bold tabular-nums', row.strong && TONE_TEXT_CLASSES[row.strong])}>{row.value}</span>
              <SourceTag className="@max-md/story:col-start-2 @max-md/story:justify-self-start" tag={row.tag} />
            </div>
          ))}
    </div>
  )
}
