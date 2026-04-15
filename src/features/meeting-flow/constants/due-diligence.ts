import {
  AwardIcon,
  ClipboardListIcon,
  HeadphonesIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
  UsersIcon,
} from 'lucide-react'
import { companyInfo } from '@/shared/constants/company'

const primaryLicense = companyInfo.licenses[0]
const generalLiability = companyInfo.insurances.find(i => i.label.includes('General Liability'))
const numProjects = companyInfo.numProjects

export const DUE_DILIGENCE_ITEMS = [
  {
    icon: ShieldCheckIcon,
    title: 'Proper Licensing & Permits',
    short: 'Licensed & insured is the bare minimum.',
    description:
      'Your contractor should own and hold the proper license for your project, and pull the right permit with the right trade. Licensed and insured is the bare minimum.',
    stat: `#${primaryLicense?.licenseNumber ?? '—'}`,
    statLabel: 'CA License',
  },
  {
    icon: ClipboardListIcon,
    title: 'Clear Scope of Work',
    short: 'Protects you. Eliminates discrepancies.',
    description:
      'Demand a clear and clearly-defined scope of work. This protects you and eliminates many discrepancies that can happen along the way.',
    stat: '100%',
    statLabel: 'Written & Detailed',
  },
  {
    icon: UsersIcon,
    title: 'Proper Supervision',
    short: 'Two sets of eyes. Measure twice, cut once.',
    description:
      'Make sure you have proper supervision on your project. We recommend at least 2 sets of eyes — they will ensure they measure twice and cut once.',
    stat: '2+',
    statLabel: 'Supervisors Per Job',
  },
  {
    icon: MessageSquareIcon,
    title: 'Communication',
    short: 'Know your point of contact and what to expect.',
    description:
      'Make sure you know how communication will work on this project. Know who your point of contact is and what to expect.',
    stat: '1',
    statLabel: 'Dedicated Contact',
  },
  {
    icon: HeadphonesIcon,
    title: 'Office Support',
    short: 'A full team behind every project.',
    description:
      'Make sure you have enough office support. Know what your contractor is offering you and at what quality.',
    stat: `${companyInfo.teamInfo.numEmployees}+`,
    statLabel: 'Support Staff',
  },
  {
    icon: AwardIcon,
    title: 'Proof of Performance',
    short: 'References, testimonials, real results.',
    description:
      'Make sure you check for solid proof of performance. Ask to see reference projects, testimonials, past clients, and relevant customer successes.',
    stat: `${numProjects}+`,
    statLabel: 'Projects Completed',
  },
] as const

export const CREDENTIAL_ITEMS = [
  { label: 'Licensed CA Contractor', value: `#${primaryLicense?.licenseNumber ?? '—'}` },
  { label: 'General Liability', value: generalLiability?.coverage ?? '$1M Coverage' },
  { label: 'Workmanship Warranty', value: '5 Years' },
  { label: 'SoCal Projects', value: `${numProjects}+` },
] as const
