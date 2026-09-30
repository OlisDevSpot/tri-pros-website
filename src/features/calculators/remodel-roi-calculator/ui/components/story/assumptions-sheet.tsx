'use client'

import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'
import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { useFormContext } from 'react-hook-form'

import { BILL_CATEGORIES, BILL_CATEGORY_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { AGING_TRADE_KEYS, CURRENT_LABELS, TRADE_KEYS, TRADE_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/trades'
import { useStoryUi } from '@/features/calculators/remodel-roi-calculator/contexts/story-ui-context'
import { formatCuts } from '@/features/calculators/remodel-roi-calculator/lib/format-cuts'
import { formatMoney, roundMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { SourceTag } from '@/features/calculators/remodel-roi-calculator/ui/components/story/source-tag'
import { BlockEyebrow } from '@/shared/components/block/block-eyebrow'
import { ResponsiveSheet } from '@/shared/components/dialogs/sheets/responsive-sheet'
import { FormNumberField } from '@/shared/components/inputs/form-number-field'

interface Props {
  projection: RemodelRoiProjection
  config: RemodelRoiConfig
}

export function AssumptionsSheet({ projection, config }: Props) {
  const { control } = useFormContext<RemodelRoiFormValues>()
  const { sheet, closeSheet } = useStoryUi()
  return (
    <ResponsiveSheet description={STORY_COPY.assumptionsDescription} drawerClassName="max-h-[85vh]" onOpenChange={open => !open && closeSheet()} open={sheet?.kind === 'assumptions'} sheetClassName="sm:max-w-[460px]" title={STORY_COPY.assumptions}>
      <div className="grid gap-3.5">
        <p className="flex items-start gap-2 text-xs leading-snug text-muted-foreground">
          <SourceTag tag="assumption" />
          Leave a field empty to use the working number shown. Change any of them and every chapter updates. The years to look ahead live in the top bar.
        </p>
        <BlockEyebrow className="pt-2">Rates rise each year</BlockEyebrow>
        <div className="grid grid-cols-2 gap-3">
          {BILL_CATEGORIES.map(category => <FormNumberField control={control} key={category} label={BILL_CATEGORY_LABELS[category]} max={50} min={-20} name={`assumptions.ratesPercent.${category}`} placeholder={String(config.defaultRatesPercent[category])} step={0.1} suffix="%/yr" />)}
        </div>
        <BlockEyebrow className="pt-2">Building and home values</BlockEyebrow>
        <div className="grid grid-cols-2 gap-3">
          <FormNumberField control={control} label="Building costs rise" max={50} min={-20} name="assumptions.constructionPercent" placeholder={String(config.defaultConstructionPercent)} step={0.1} suffix="%/yr" />
          <FormNumberField control={control} label="Home values rise" max={50} min={-20} name="assumptions.homeAppreciationPercent" placeholder={String(config.defaultHomeAppreciationPercent)} step={0.1} suffix="%/yr" />
          <FormNumberField control={control} hint={`≈ ${roundMoney(projection.valueAddedToday)} today`} label="Value the upgrade adds" max={100} name="assumptions.valueAddedPercent" placeholder={String(config.defaultValueAddedPercent)} suffix="% of price" />
        </div>
        <BlockEyebrow className="pt-2">What each trade cuts, and how long a new one lasts</BlockEyebrow>
        <div className="grid border-t">
          {TRADE_KEYS.map(trade => (
            <div className="flex justify-between gap-3 border-b border-dashed py-1.5 text-sm" key={trade}>
              <span>{TRADE_LABELS[trade]}</span>
              <span className="text-right text-muted-foreground">
                {formatCuts(config.trades[trade].cutsPercent)}
                {trade === 'hvac' && ` · ducts ${formatCuts(config.trades.hvac.ductsCutsPercent)}`}
                {` · lasts ${config.trades[trade].newLifeYears == null ? 'the life of the home' : `${config.trades[trade].newLifeYears} yrs`}`}
              </span>
            </div>
          ))}
        </div>
        <BlockEyebrow className="pt-2">The current one, replaced like-for-like</BlockEyebrow>
        <div className="grid border-t">
          {AGING_TRADE_KEYS.map(trade => (
            <div className="flex justify-between gap-3 border-b border-dashed py-1.5 text-sm" key={trade}>
              <span>{CURRENT_LABELS[trade]}</span>
              <span className="text-right text-muted-foreground">
                {config.trades[trade].current.standardLifeYears}
                {' '}
                yrs ·
                {' '}
                {formatMoney(config.trades[trade].current.likeForLikePrice)}
                {' '}
                · repairs
                {' '}
                {formatMoney(config.trades[trade].current.repairsPerYear)}
                /yr
              </span>
            </div>
          ))}
        </div>
      </div>
    </ResponsiveSheet>
  )
}
