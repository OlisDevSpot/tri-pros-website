import type { PillarSlug } from '@/features/landing/lib/notion-trade-helpers'

interface PillarStat {
  value: string
  label: string
}

interface ProjectApproachStep {
  title: string
  description: string
}

interface PillarPairing {
  trade1Name: string
  trade1Slug: string
  trade2Name: string
  trade2Slug: string
  story: string
}

interface PillarConfig {
  title: string
  heroHeadline: string
  heroSubheadline: string
  stats: PillarStat[]
  defaultHeroImage: string
  emotionalDriver: string
  programsTeaserCopy: string
  projectApproach: ProjectApproachStep[]
  pairings: PillarPairing[]
}

export const pillarConfigs: Record<PillarSlug, PillarConfig> = {
  'energy-efficient-construction': {
    title: 'Energy-Efficient Construction',
    heroHeadline: 'Your Home Is Costing You More Than It Should',
    heroSubheadline: 'A complete energy envelope upgrade — insulation, HVAC, windows, solar, roofing — delivered by one contractor, in one mobilization, with compounding savings.',
    stats: [
      { value: '30–55%', label: 'Average Bill Reduction' },
      { value: '$3,200', label: 'In Federal Tax Credits' },
      { value: '6–18 mo', label: 'Typical Payback' },
    ],
    defaultHeroImage: '/services/energy-efficient-hero.jpg',
    emotionalDriver: 'loss-aversion',
    programsTeaserCopy: 'Federal and state programs are actively funding these upgrades. Caps apply annually — timing matters.',
    projectApproach: [
      { title: 'Discovery', description: 'We walk your home with you. We listen first, recommend second.' },
      { title: 'Tailored Proposal', description: 'A scope built around what you told us — not a cookie-cutter estimate.' },
      { title: 'Professional Installation', description: 'Licensed crews, proper permits, city inspection, workmanship warranty.' },
    ],
    pairings: [
      { trade1Name: 'Insulation', trade1Slug: 'attic-and-basement', trade2Name: 'HVAC', trade2Slug: 'hvac', story: 'Seal the envelope, upgrade the system. Your bills drop from both sides.' },
      { trade1Name: 'Roofing', trade1Slug: 'roof-and-gutters', trade2Name: 'Solar', trade2Slug: 'solar', story: 'A new roof is the ideal foundation for solar — one install, better ROI.' },
      { trade1Name: 'Windows', trade1Slug: 'windows-and-doors', trade2Name: 'Insulation', trade2Slug: 'attic-and-basement', story: 'Complete envelope sealing — the most cost-effective energy upgrade.' },
    ],
  },
  'luxury-renovations': {
    title: 'Luxury Renovations',
    heroHeadline: 'The Home You\'ve Always Wanted — Built to Last',
    heroSubheadline: 'Kitchens, bathrooms, flooring, additions, outdoor living, and more. Every project backed by a licensed team, proper permits, and a written warranty.',
    stats: [
      { value: '60–80%', label: 'Kitchen Remodel ROI' },
      { value: '520+', label: 'Projects Completed' },
      { value: '98%', label: 'Client Satisfaction' },
    ],
    defaultHeroImage: '/services/luxury-renovations-hero.jpg',
    emotionalDriver: 'pride-of-ownership',
    programsTeaserCopy: 'Exclusive monthly packages with preferred pricing, expedited scheduling, and a written workmanship warranty on every project.',
    projectApproach: [
      { title: 'Discovery', description: 'We walk your home with you. We listen first, recommend second.' },
      { title: 'Tailored Proposal', description: 'A scope built around what you told us — not a cookie-cutter estimate.' },
      { title: 'Professional Installation', description: 'Licensed crews, proper permits, city inspection, workmanship warranty.' },
    ],
    pairings: [
      { trade1Name: 'Bathroom', trade1Slug: 'bathroom-remodel', trade2Name: 'Flooring', trade2Slug: 'flooring', story: 'Updating the bathroom? The transition to new flooring in the hallway is natural and seamless.' },
      { trade1Name: 'Kitchen', trade1Slug: 'kitchen-remodel', trade2Name: 'Interior Paint', trade2Slug: 'patch-and-interior-paint', story: 'A remodeled kitchen paired with fresh paint transforms how the whole home feels.' },
      { trade1Name: 'ADU', trade1Slug: 'adu', trade2Name: 'Engineering & Plans', trade2Slug: 'engineering-plans-and-blueprints', story: 'From blueprints to finished unit — one team, one process.' },
    ],
  },
}
