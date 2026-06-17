import { companyInfo } from './company-info'
import { insurances } from './insurances'

// e.g. 'Up to $5M' -> '$5M'
const bondingCapacity = insurances.find(i => i.label === 'Bonded')!.coverage.replace('Up to ', '')

export const stats = [
  {
    label: 'BBB Rating',
    description: `Accredited since ${companyInfo.yearFounded}`,
    number: 'A+',
  },
  {
    label: 'Licensed & Bonded',
    description: 'Fully compliant',
    number: '100%',
  },
  {
    label: 'Bonding Capacity',
    description: 'Large project coverage',
    number: bondingCapacity,
  },
  {
    label: 'Years Combined Experience',
    description: 'Across our team',
    number: `${companyInfo.combinedYearsExperience}+`,
  },
]
