import { companyInfo } from '@/shared/constants/company'
import { ChapterHeader } from './chapter-header'
import { ChapterInner } from './chapter-inner'
import { CompanyDocumentsRow } from './company-documents-row'
import { ContractorQuestions } from './contractor-questions'
import { ReviewStanding } from './review-standing'

export function TrustedContractor() {
  return (
    <div className="bg-background">
      <ChapterInner>
        <ChapterHeader chapter="contractor" title={`What you get with ${companyInfo.nickname}`} lede="Four questions every homeowner asks a contractor, and how we answer each one." />
        <ReviewStanding />
        <ContractorQuestions />
        <CompanyDocumentsRow />
      </ChapterInner>
    </div>
  )
}
