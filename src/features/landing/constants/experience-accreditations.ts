import { certifications } from '@/shared/constants/company/certifications'
import { licenses } from '@/shared/constants/company/licenses'

interface AccreditationItem {
  label: string
}

const licenseLabels: AccreditationItem[] = licenses.map(l => ({
  label: `License #${l.licenseNumber}`,
}))

const certificationShortLabels: Record<string, string> = {
  'NARI Certified Professional': 'NARI Certified',
  'LEED Accredited Professional': 'LEED AP',
  'OSHA 30-Hour Construction Safety Certification': 'OSHA 30',
  'EPA Lead-Safe Certified': 'EPA Lead-Safe',
}

const certificationLabels: AccreditationItem[] = certifications.map(c => ({
  label: certificationShortLabels[c.label] ?? c.label,
}))

export const experienceAccreditations: AccreditationItem[] = [
  ...licenseLabels,
  ...certificationLabels,
]
