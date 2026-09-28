'use client'

import type { UsesRow } from '@/features/calculators/remodel-roi-calculator/types'

import { useStoryUi } from '@/features/calculators/remodel-roi-calculator/contexts/story-ui-context'
import { SourceTag } from '@/features/calculators/remodel-roi-calculator/ui/components/story/source-tag'

interface Props {
  rows: UsesRow[]
}

export function UsesList({ rows }: Props) {
  const { editSection, openAssumptions } = useStoryUi()
  return (
    <div className="grid border-t">
      {rows.map(row => (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_7rem_3rem] items-center gap-2.5 border-b border-dashed py-2 text-[13.5px]" key={row.label}>
          <span>{row.label}</span>
          <span className="whitespace-nowrap text-right font-extrabold tabular-nums">{row.value}</span>
          <SourceTag tag={row.tag} />
          {row.edit
            ? <button className="min-h-11 text-xs font-bold text-primary" onClick={() => (row.edit === 'assumptions' ? openAssumptions() : row.edit && editSection(row.edit))} type="button">Edit</button>
            : <span />}
        </div>
      ))}
    </div>
  )
}
