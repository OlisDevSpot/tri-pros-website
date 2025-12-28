export const navigationItems = [
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
] as const

type ServiceSlugsRaw = Extract<typeof navigationItems[number], { href: '/services' }>['subItems'][number]['href']
type RemoveServices<T> = T extends `/services/${infer Rest}` ? Rest : never

export type ServiceSlugs = RemoveServices<ServiceSlugsRaw>
