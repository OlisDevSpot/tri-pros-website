import Image from 'next/image'
import { COMPARISON_COLUMNS } from '@/features/meeting-flow/constants/who-we-are-slides'
import { getComparisonRows } from '@/features/proposal-flow/lib/get-comparison-rows'
import { CompanySocialButtons } from '@/shared/components/company-social-buttons'
import { LogoLink } from '@/shared/components/logo'
import { R2_BUCKETS, R2_PUBLIC_DOMAINS } from '@/shared/services/providers/r2/types'
import { ComparisonList } from './comparison-list'

const DOCS_BASE = R2_PUBLIC_DOMAINS[R2_BUCKETS.companyDocs] ?? ''

const DOCS = {
  license: {
    title: 'License',
    subtitle: 'Verified and current',
    src: `${DOCS_BASE}/tpr-license.jpg`,
    alt: 'Tri Pros Remodeling contractor license',
  },
  insurance: {
    title: 'Insurance',
    subtitle: 'Liability coverage on file',
    src: `${DOCS_BASE}/tpr-coi-2026.jpg`,
    alt: 'Tri Pros Remodeling certificate of insurance',
  },
} as const

export function TrustedContractor() {
  return (
    <div className="px-4 py-12 sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="grid gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Trusted contractor</p>
          <h2 id="about-tri-pros-title" className="text-3xl font-semibold text-balance">{`${COMPARISON_COLUMNS.triPros} vs other contractors`}</h2>
        </header>

        <ComparisonList rows={getComparisonRows()} />

        <details className="rounded-lg border border-border bg-card p-4">
          <summary className="cursor-pointer font-semibold">View license and insurance documents</summary>
          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {(Object.values(DOCS) as Array<(typeof DOCS)[keyof typeof DOCS]>).map(doc => (
              <section key={doc.title} className="min-w-0 space-y-3">
                <header className="flex items-baseline justify-between gap-3">
                  <h3 className="text-base font-semibold">{doc.title}</h3>
                  <span className="text-xs text-muted-foreground">{doc.subtitle}</span>
                </header>
                <div className="overflow-hidden rounded-xl bg-muted ring-1 ring-border">
                  <Image src={doc.src} alt={doc.alt} width={1200} height={1600} className="h-auto w-full" />
                </div>
              </section>
            ))}
          </div>
        </details>

        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="h-12.5 w-45 shrink-0">
            <LogoLink />
          </div>
          <CompanySocialButtons className="lg:flex-row" />
        </div>
      </div>
    </div>
  )
}
