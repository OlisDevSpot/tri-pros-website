import { CheckIcon, ShieldCheckIcon } from 'lucide-react'
import { ReputationMark } from '@/shared/components/reputation-mark'
import { companyInfo, liabilityCoverage, primaryLicense, REPUTATION_MARKS, reviews } from '@/shared/constants/company'

const [asOfYear, asOfMonth] = reviews.asOf.split('-').map(Number)
// A calendar month, not an instant: read and printed in UTC so no time zone moves it to the month before.
const RATINGS_AS_OF = new Date(Date.UTC(asOfYear!, asOfMonth! - 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

export function ReviewStanding() {
  return (
    <>
      <div>
        <ul aria-label="Our ratings" className="grid gap-2.5 @min-[560px]/proposal:grid-cols-3">
          {REPUTATION_MARKS.map(mark => <ReputationMark key={mark.platform} mark={mark} tone="page" />)}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">{`Ratings as of ${RATINGS_AS_OF}`}</p>
      </div>
      <p className="flex flex-wrap gap-x-4.5 gap-y-1.5 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CheckIcon aria-hidden className="size-3.75 shrink-0 text-status-success-fg" />
          {`${companyInfo.numProjects}+ projects completed`}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheckIcon aria-hidden className="size-3.75 shrink-0 text-status-success-fg" />
          {`${liabilityCoverage} liability insurance per project`}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckIcon aria-hidden className="size-3.75 shrink-0 text-status-success-fg" />
          {`CA license #${primaryLicense.licenseNumber} · bonded`}
        </span>
      </p>
    </>
  )
}
