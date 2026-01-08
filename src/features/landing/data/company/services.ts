import type { ServiceSlugs } from '@/shared/constants/nav-items/marketing'

interface Service {
  slug: ServiceSlugs
  title: string
  subtitle: string
  description: string
  features: string[]
  timeline: string
  priceRange: string
  image: string
  href: string
  icon: string
}

export const services: Service[] = [
  {
    slug: 'energy-efficient-construction',
    title: 'Energy-Efficient Construction',
    subtitle: 'Sustainable Homes for a Greener Future',
    description:
      'Elevate your home\'s energy efficiency and environmental impact with our energy-efficient construction services.',
    features: [
      'Insulation upgrades',
      'Solar panels installation',
      'Energy-efficient windows',
      'Green roofing solutions',
      'Smart home technology integration',
      'Energy-efficient lighting',
    ],
    timeline: '0.5 - 5 months',
    priceRange: '$10k - $250k',
    image: '/hero-photos/modern-house-1.png',
    get href() {
      return `/services/${this.slug}`
    },
    icon: '🏠',
  },
  {
    slug: 'luxury-renovations',
    title: 'Luxury Renovations',
    subtitle: 'Transform Your Space with Premium Upgrades',
    description:
      'Elevate your existing home with our luxury renovation services. Whether it&apos;s a complete makeover or targeted improvements, we deliver exceptional results.',
    features: [
      'Kitchen and bathroom remodeling',
      'Whole-home renovations',
      'Historic restoration',
      'Room additions and extensions',
      'Smart home technology integration',
      'Energy efficiency upgrades',
    ],
    timeline: '3 - 12 months',
    priceRange: '$100k - $1M+',
    image: '/hero-photos/modern-house-2.png',
    href: '/services/renovations',
    icon: '🔨',
  },
  {
    slug: 'commercial',
    title: 'Commercial Construction',
    subtitle: 'Professional Buildings for Growing Businesses',
    description:
      'From office buildings to retail spaces, we construct commercial properties that enhance business success and provide lasting value.',
    features: [
      'Office buildings and complexes',
      'Retail and restaurant spaces',
      'Medical and professional facilities',
      'Warehouse and industrial buildings',
      'Mixed-use developments',
      'Tenant improvement projects',
    ],
    timeline: '6 - 24 months',
    priceRange: '$250k - $5M+',
    image: '/hero-photos/commercial-construction-2.jpg',
    href: '/services/commercial',
    icon: '🏢',
  },
  {
    slug: 'design-build',
    title: 'Design-Build Services',
    subtitle: 'Streamlined Process from Concept to Completion',
    description:
      'Our integrated design-build approach ensures seamless coordination between architects, designers, and builders for optimal results.',
    features: [
      'Comprehensive design development',
      'Single-source responsibility',
      'Faster project delivery',
      'Enhanced quality control',
      'Better cost management',
      'Simplified communication',
    ],
    timeline: '4 - 16 months',
    priceRange: '$200k - $2M+',
    image: '/hero-photos/modern-house-4.webp',
    href: '/services/design-build',
    icon: '📐',
  },
] as const
