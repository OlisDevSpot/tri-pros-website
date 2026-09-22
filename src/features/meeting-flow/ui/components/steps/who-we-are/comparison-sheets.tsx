import type { ComparisonRow } from '@/features/meeting-flow/types'
import { ComparisonSheet } from '@/features/meeting-flow/ui/components/steps/who-we-are/comparison-sheet'

interface ComparisonSheetsProps {
  rows: ComparisonRow[]
}

/**
 * Tri Pros' sheet beside a typical quote (C2). The wrapper is the `comparison` container,
 * so the sheets stack when the table itself is narrower than 44rem, whatever the
 * presentation is doing: in column mode the table has about 62% of the scroller, in band
 * mode all of it (spec C §4.3, §12 S10). Inside it `cqw` measures the table, so every size
 * here is a role token or rem. This is the one container the engine does not own.
 */
export function ComparisonSheets({ rows }: ComparisonSheetsProps) {
  return (
    <div className="@container/comparison">
      <div className="grid grid-cols-[3fr_2fr] items-start gap-presentation-group @max-[44rem]/comparison:grid-cols-1">
        <ComparisonSheet rows={rows} side="triPros" />
        <ComparisonSheet rows={rows} side="others" />
      </div>
    </div>
  )
}
