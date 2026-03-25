import {
  AwardIcon,
  ClipboardListIcon,
  HeadphonesIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
  UsersIcon,
} from 'lucide-react'

export const DUE_DILIGENCE_ITEMS = [
  {
    description:
      'Your contractor should own and hold the proper license for your project, and pull the right permit with the right trade. Licensed and insured is the bare minimum.',
    icon: ShieldCheckIcon,
    title: 'Proper Licensing & Permits',
  },
  {
    description:
      'Demand a clear and clearly-defined scope of work. This protects you and eliminates many discrepancies that can happen along the way.',
    icon: ClipboardListIcon,
    title: 'Clear Scope of Work',
  },
  {
    description:
      'Make sure you have proper supervision on your project. We recommend at least 2 sets of eyes — they will ensure they measure twice and cut once.',
    icon: UsersIcon,
    title: 'Proper Supervision',
  },
  {
    description:
      'Make sure you know how communication will work on this project. Know who your point of contact is and what to expect.',
    icon: MessageSquareIcon,
    title: 'Communication',
  },
  {
    description:
      'Make sure you have enough office support. Know what your contractor is offering you and at what quality.',
    icon: HeadphonesIcon,
    title: 'Office Support',
  },
  {
    description:
      'Make sure you check for solid proof of performance. Ask to see reference projects, testimonials, past clients, and relevant customer successes.',
    icon: AwardIcon,
    title: 'Proof of Performance',
  },
] as const
