// LAZY: Parked for the Benefits interior; re-homed or deleted there.
'use client'

import { SAVINGS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { SAVINGS_CATEGORIES } from '@/features/trade-scenes/constants/savings-categories'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { installsInsulation } from '@/features/trade-scenes/lib/installs-insulation'
import { savingsFigures } from '@/features/trade-scenes/lib/savings-figures'
import { CutOverride } from '@/features/trade-scenes/ui/components/panel/cut-override'
import { SavingsBars } from '@/features/trade-scenes/ui/components/panel/savings-bars'
import { SavingsFigure } from '@/features/trade-scenes/ui/components/panel/savings-figure'
import { SavingsReadAmounts } from '@/features/trade-scenes/ui/components/panel/savings-read-amounts'

// Reads the resolved savings and holds no state, so it never disagrees with the scene it describes.
// The one figure that answers "how much" leads; the bars under it say where it comes from, and the amounts at the foot say
// what it was worked out from.
export function SavingsTab() {
  const targets = useSceneTargets()
  const { cuts, repairsByTrade } = targets.savings
  const { disclosure } = SAVINGS_COPY

  // Every landed trade carries a repairs entry, so it is also the test for "the preview draws some work".
  const landed = Object.keys(repairsByTrade).length > 0
  const figures = savingsFigures(targets.savings)
  const vary = installsInsulation(targets.assemblies) ? disclosure.rValue : disclosure.vary
  const sourceOf = (typed: boolean) => typed ? disclosure.typedSource : disclosure.tradesSource
  const sources = [
    ...SAVINGS_CATEGORIES.map((category) => {
      const cut = cuts[category]
      return {
        id: category,
        label: SAVINGS_COPY.billLabel(category),
        monthly: figures.bills[category],
        disclosure: [sourceOf(cut.typed), vary],
        children: landed && cut.bill > 0 && (
          <>
            {!cut.typed && cut.parts.length === 0 && <p className="text-xs text-muted-foreground">{SAVINGS_COPY.noCut(category)}</p>}
            <CutOverride category={category} cut={cut} />
          </>
        ),
      }
    }),
    // The R-value wording is a claim about insulation, so it never rides on the repairs figure.
    { id: 'repairs', label: SAVINGS_COPY.repairsBar, monthly: figures.repairs, disclosure: [disclosure.repairsSource, disclosure.vary] },
  ]
  const shown = sources.flatMap(source => source.monthly === null ? [] : [{ ...source, monthly: source.monthly }])
  const sourceLines = SAVINGS_CATEGORIES.flatMap(category => figures.bills[category] === null ? [] : [sourceOf(cuts[category].typed)])
  // "Together" sums two or more; with one source saving, that source leads on its own rather than leaving the top empty.
  const lead = figures.total !== null
    ? { label: SAVINGS_COPY.total, monthly: figures.total, disclosure: [...new Set(sourceLines), ...(figures.repairs === null ? [] : [disclosure.repairsSource]), vary] }
    : shown.length === 1 ? shown[0] : null

  // Work landed but nothing saves (no bills typed, repairs set to $0): one line says so, and the bars stay only while a
  // typed bill still offers its cut.
  const nothingSaved = landed && lead === null
  const offersCut = SAVINGS_CATEGORIES.some(category => cuts[category].bill > 0)

  return (
    <div className="grid gap-5">
      <div className="rounded-lg bg-tab-track p-4">
        {lead === null
          ? <p className="text-sm text-muted-foreground">{nothingSaved ? SAVINGS_COPY.nothingSaved : SAVINGS_COPY.nothingLanded}</p>
          : <SavingsFigure label={lead.label} monthly={lead.monthly} disclosure={lead.disclosure} />}
      </div>
      {(!nothingSaved || offersCut) && <SavingsBars sources={sources} />}
      <SavingsReadAmounts cuts={cuts} repairsByTrade={repairsByTrade} />
    </div>
  )
}
