import { R2_BUCKETS, R2_PUBLIC_DOMAINS } from '@/shared/services/providers/r2/types'
import { companyInfo } from './company-info'

const DOCS_BASE = R2_PUBLIC_DOMAINS[R2_BUCKETS.companyDocs]!

export interface CompanyDocument {
  title: string
  subtitle: string
  alt: string
  /** The first page; a one-page scan is all of it. */
  src: string
  pages: string[]
  /** Every page shares one pixel size. */
  width: number
  height: number
}

/** The license and insurance scans the homeowner can open. */
export const COMPANY_DOCUMENTS = {
  license: {
    title: 'Contractor license',
    subtitle: 'Verified and current',
    alt: `${companyInfo.name} contractor license`,
    src: `${DOCS_BASE}/tpr-license.jpg`,
    pages: [`${DOCS_BASE}/tpr-license.jpg`],
    width: 1800,
    height: 1200,
  },
  insurance: {
    title: 'Certificate of insurance',
    subtitle: 'Liability coverage on file',
    alt: `${companyInfo.name} certificate of liability insurance`,
    src: `${DOCS_BASE}/tpr-coi-2026.jpg`,
    pages: [`${DOCS_BASE}/tpr-coi-2026.jpg`],
    width: 2550,
    height: 3300,
  },
} as const satisfies Record<string, CompanyDocument>
