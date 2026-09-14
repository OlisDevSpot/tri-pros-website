import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { Badge } from '@/shared/components/ui/badge'

interface TradeSheetHeaderProps {
  inCatalog: boolean
  summary: string
}

/** The live count line under the primitive's title. Updates in place on every toggle. */
export function TradeSheetHeader({ inCatalog, summary }: TradeSheetHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p aria-live="polite" className="text-base font-medium">{summary}</p>
      {!inCatalog && <Badge variant="outline">{SPECIALTIES_COPY.sheet.notInCatalog}</Badge>}
    </div>
  )
}
