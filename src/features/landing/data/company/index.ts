import { awards } from './awards'
import { certifications } from './certifications'
import { contactInfo } from './contact-info'
import { insurances } from './insurances'
import { licenses } from './licenses'
import { teamInfo } from './team-info'
import { testimonials } from './testimonials'

export { awards } from './awards'
export { certifications } from './certifications'
export { contactInfo } from './contact-info'
export { insurances } from './insurances'
export { licenses } from './licenses'
export { teamInfo } from './team-info'
export { testimonials } from './testimonials'

export const companyInfo = {
  name: 'Tri Pros Remodeling',
  logo: '/logo.png',
  yearFounded: 1998,
  numProjects: 520,
  generations: 3,
  clientSatisfaction: 0.98,
  projectsDelivered: 50_000_000,
  contactInfo,
  insurances,
  licenses,
  certifications,
  awards,
  teamInfo,
  testimonials,
}
