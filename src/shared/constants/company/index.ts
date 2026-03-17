import { awards } from './awards'
import { certifications } from './certifications'
import { contactInfo } from './contact-info'
import { insurances } from './insurances'
import { licenses } from './licenses'
import { socials } from './socials'
import { teamInfo } from './team-info'
import { testimonials } from './testimonials'

export { awards } from './awards'
export { certifications } from './certifications'
export { contactInfo } from './contact-info'
export { insurances } from './insurances'
export { licenses } from './licenses'
export { socials } from './socials'
export { teamInfo } from './team-info'
export { testimonials } from './testimonials'

export const companyInfo = {
  name: 'Tri Pros Remodeling',
  nickname: 'Tri Pros',
  logo: '/logo.png',
  yearFounded: 2021,
  yearsOld: () => new Date().getFullYear() - companyInfo.yearFounded,
  combinedYearsExperience: 40,
  numProjects: 520,
  valueOfProjectsInDollars: 9_000_000,
  generations: 2,
  clientSatisfaction: 0.98,
  contactInfo,
  insurances,
  licenses,
  certifications,
  awards,
  teamInfo,
  testimonials,
  socials,
}
