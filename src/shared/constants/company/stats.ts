import { companyInfo } from './company-info'
import { reviews } from './reviews'

export const stats = [
  {
    label: 'BBB Rating',
    description: `Accredited since ${companyInfo.yearFounded}`,
    number: reviews.bbb.rating,
  },
  {
    label: 'Licensed & Bonded',
    description: 'Fully compliant',
    number: '100%',
  },
  {
    label: 'Years Combined Experience',
    description: 'Across our team',
    number: `${companyInfo.combinedYearsExperience}+`,
  },
]
