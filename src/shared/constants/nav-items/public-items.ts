import type { NavItem } from '@/shared/types/nav'

export const publicNavItems = [
  {
    name: 'Tri Pros Experience',
    href: '/experience',
  },
  {
    name: 'About',
    href: '/about',
  },
  {
    name: 'Community',
    href: '/community',
    action: 'readonly',
    subItems: [
      {
        name: 'Community Commitment',
        href: '/community/commitment',
      },
      {
        name: 'Join Our Efforts',
        href: '/community/join',
      },
    ],
  },
  {
    name: 'Services',
    href: '/services',
    subItems: [
      {
        name: 'Energy-Efficient Construction',
        href: '/services/energy-efficient-construction',
      },
      {
        name: 'Luxury Renovations',
        href: '/services/luxury-renovations',
      },
      {
        name: 'Design-Build Services',
        href: '/services/design-build',
      },
      {
        name: 'Commercial Projects',
        href: '/services/commercial',
      },
    ],
  },
  {
    name: 'Portfolio',
    href: '/portfolio',
    subItems: [
      {
        name: 'Projects',
        href: '/portfolio/projects',
      },
      {
        name: 'Testimonials',
        href: '/portfolio/testimonials',
      },
    ],
  },
  {
    name: 'Blog',
    href: '/blog',
  },
] as const satisfies NavItem[]

type ServiceSlugsRaw = Extract<typeof publicNavItems[number], { href: '/services' }>['subItems'][number]['href']
type RemoveServices<T> = T extends `/services/${infer Rest}` ? Rest : never

export type ServiceSlugs = RemoveServices<ServiceSlugsRaw>
