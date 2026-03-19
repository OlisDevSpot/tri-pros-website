import type { NavItem } from '@/shared/types/nav'
import { ROOTS } from '@/shared/config/roots'

export const marketingNavItems = [
  {
    name: 'Tri Pros Experience',
    href: ROOTS.landing.experience(),
    action: 'navigate',
  },
  {
    name: 'About',
    href: ROOTS.landing.about(),
    action: 'navigate',
  },
  {
    name: 'Community',
    action: 'readonly',
    subItems: [
      {
        name: 'Community Commitment',
        href: ROOTS.landing.communityCommitment(),
        action: 'navigate',
      },
      {
        name: 'Join Our Efforts',
        href: ROOTS.landing.communityJoin(),
        action: 'navigate',
      },
    ],
  },
  {
    name: 'Services',
    action: 'readonly',
    subItems: [
      {
        name: 'Energy-Efficient Construction',
        href: ROOTS.landing.servicesPillar('energy-efficient-construction'),
        action: 'navigate',
      },
      {
        name: 'Luxury Renovations',
        href: ROOTS.landing.servicesPillar('luxury-renovations'),
        action: 'navigate',
      },
      {
        name: 'Design-Build Services',
        href: ROOTS.landing.servicesPillar('design-build'),
        action: 'navigate',
      },
      {
        name: 'Commercial Projects',
        href: ROOTS.landing.servicesPillar('commercial'),
        action: 'navigate',
      },
    ],
  },
  {
    name: 'Portfolio',
    action: 'readonly',
    subItems: [
      {
        name: 'Projects',
        href: ROOTS.landing.portfolioProjects(),
        action: 'navigate',
      },
      {
        name: 'Testimonials',
        href: ROOTS.landing.portfolioTestimonials(),
        action: 'navigate',
      },
    ],
  },
  {
    name: 'Blog',
    href: ROOTS.landing.blog(),
    action: 'navigate',
  },
] satisfies NavItem[]

export type ServiceSlugs = 'energy-efficient-construction' | 'luxury-renovations' | 'commercial' | 'design-build'
