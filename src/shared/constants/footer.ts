import { ROOTS } from '@/shared/config/roots'

export const footerData = [
  {
    title: 'Services',
    links: [
      { name: 'Custom Home Construction', href: ROOTS.landing.servicesPillar('energy-efficient-construction') },
      { name: 'Luxury Renovations', href: ROOTS.landing.servicesPillar('luxury-renovations') },
      { name: 'Commercial Projects', href: ROOTS.landing.servicesPillar('commercial') },
      { name: 'Design-Build Services', href: ROOTS.landing.servicesPillar('design-build') },
    ],
  },
  {
    title: 'Company',
    links: [
      { name: 'About Us', href: ROOTS.landing.about() },
      { name: 'Tri Pros Experience', href: ROOTS.landing.experience() },
      { name: 'Projects', href: ROOTS.landing.portfolioProjects() },
      { name: 'Testimonials', href: ROOTS.landing.portfolioTestimonials() },
    ],
  },
  {
    title: 'Resources',
    links: [
      { name: 'Contact Us', href: ROOTS.landing.contact() },
      { name: 'Careers', href: ROOTS.landing.communityJoin() },
    ],
  },
]
