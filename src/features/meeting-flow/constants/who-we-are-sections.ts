import type { PinnedSummary, WhoWeAreSection } from '@/features/meeting-flow/types'
import { DUE_DILIGENCE_ITEMS } from '@/features/meeting-flow/constants/due-diligence'
import { companyInfo } from '@/shared/constants/company'
import { R2_BUCKETS, R2_PUBLIC_DOMAINS } from '@/shared/services/providers/r2/types'

const DOCS_BASE = R2_PUBLIC_DOMAINS[R2_BUCKETS.companyDocs] ?? ''
const founder = companyInfo.teamInfo.owners[0]
const [licensing, scope, supervision, communication, office, performance] = DUE_DILIGENCE_ITEMS

/** Stand-in imagery from the public site until the step gets its own shoot. */
const IMAGES = {
  hook: '/hero-photos/modern-house-5.jpg',
  scope: '/process/design-stage.jpeg',
  supervision: '/process/construction-stage.jpeg',
  before: '/portfolio-photos/projects/Riviera/hero-before.jpeg',
  after: '/portfolio-photos/projects/Riviera/hero-after.jpeg',
  truth: '/process/handover-stage.jpeg',
} as const

export const WHO_WE_ARE_SECTIONS: WhoWeAreSection[] = [
  {
    kind: 'hook',
    id: 'hook',
    title: 'A successful project doesn’t start on demolition day.',
    subtitle: 'It starts when you do your',
    accent: 'due diligence.',
    image: IMAGES.hook,
    imageAlt: 'Finished home exterior at dusk',
  },
  {
    kind: 'point',
    id: 'licensing',
    number: 1,
    title: 'Proper licensing and permits',
    line: licensing.short,
    proof: licensing.stat,
    proofLabel: licensing.statLabel,
    media: {
      type: 'documents',
      documents: DOCS_BASE
        ? [
            {
              title: 'Contractor license',
              src: `${DOCS_BASE}/tpr-license.jpg`,
              alt: `${companyInfo.name} contractor license`,
            },
            {
              title: 'Certificate of insurance',
              src: `${DOCS_BASE}/tpr-coi-2026.jpg`,
              alt: `${companyInfo.name} certificate of liability insurance`,
            },
          ]
        : [],
    },
  },
  {
    kind: 'point',
    id: 'scope',
    number: 2,
    title: 'A clear scope of work',
    line: scope.short,
    proof: scope.stat,
    proofLabel: scope.statLabel,
    media: { type: 'photo', src: IMAGES.scope, alt: 'Project consultant writing a scope with plans and samples on the table' },
  },
  {
    kind: 'point',
    id: 'supervision',
    number: 3,
    title: 'Proper supervision',
    line: supervision.short,
    proof: supervision.stat,
    proofLabel: supervision.statLabel,
    media: { type: 'photo', src: IMAGES.supervision, alt: 'Crew pouring a driveway while a supervisor watches' },
  },
  {
    kind: 'point',
    id: 'communication',
    number: 4,
    title: 'Communication',
    line: communication.short,
    proof: founder.name,
    proofLabel: `${founder.title}, your direct line`,
    media: { type: 'portrait', src: `/${founder.image}`, alt: `${founder.name}, ${founder.title}` },
  },
  {
    kind: 'point',
    id: 'office',
    number: 5,
    title: 'Office support',
    line: office.short,
    proof: office.stat,
    proofLabel: office.statLabel,
    media: { type: 'placeholder', label: 'Office and team photo, to be shot' },
  },
  {
    kind: 'point',
    id: 'performance',
    number: 6,
    title: 'Proof of performance',
    line: performance.short,
    proof: performance.stat,
    proofLabel: performance.statLabel,
    media: { type: 'pair', before: IMAGES.before, after: IMAGES.after, alt: 'Riviera project' },
  },
  {
    kind: 'truth',
    id: 'truth',
    title: 'Success isn’t about the finishes.',
    quote: 'Many times it boils down to communication, supervision, leadership, and accountability. That is what makes it the real deal.',
    ctaLabel: 'Continue to Specialties',
    image: IMAGES.truth,
    imageAlt: 'Keys handed to a homeowner in their finished living room',
  },
]

const POINT_COUNT = WHO_WE_ARE_SECTIONS.filter(section => section.kind === 'point').length

export const WHO_WE_ARE_PINNED: PinnedSummary[] = WHO_WE_ARE_SECTIONS.map((section) => {
  switch (section.kind) {
    case 'hook':
      return { title: 'Navigating the construction industry', line: 'What a legitimate project actually requires.' }
    case 'point':
      return { number: section.number, title: section.title, line: section.line, count: `${section.number} of ${POINT_COUNT}` }
    case 'truth':
      return { title: 'The real deal', line: 'Done once. Done right.' }
    default:
      throw new Error(`Unknown section kind: ${section satisfies never}`)
  }
})
