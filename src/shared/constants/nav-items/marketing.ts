import type { NavItem } from '@/shared/types/nav'

export const marketingNavItems = [
  {
    name: 'Tri Pros Experience',
    href: '/experience',
    action: 'navigate',
  },
  {
    name: 'About',
    href: '/about',
    action: 'navigate',
  },
  {
    name: 'Community',
    action: 'readonly',
    subItems: [
      {
        name: 'Community Commitment',
        href: '/community/commitment',
        action: 'navigate',
      },
      {
        name: 'Join Our Efforts',
        href: '/community/join',
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
        href: '/services/energy-efficient-construction',
        action: 'navigate',
      },
      {
        name: 'Luxury Renovations',
        href: '/services/luxury-renovations',
        action: 'navigate',
      },
      {
        name: 'Design-Build Services',
        href: '/services/design-build',
        action: 'navigate',
      },
      {
        name: 'Commercial Projects',
        href: '/services/commercial',
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
        href: '/portfolio/projects',
        action: 'navigate',
      },
      {
        name: 'Testimonials',
        href: '/portfolio/testimonials',
        action: 'navigate',
      },
    ],
  },
  {
    name: 'Blog',
    href: '/blog',
    action: 'navigate',
  },
] as const satisfies NavItem[]

type ServiceSlugsRaw = Extract<typeof marketingNavItems[number], { name: 'Services' }>['subItems'][number]['href']
type RemoveServices<T> = T extends `/services/${infer Rest}` ? Rest : never

export type ServiceSlugs = RemoveServices<ServiceSlugsRaw>
