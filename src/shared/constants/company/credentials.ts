import { awards } from './awards'
import { certifications } from './certifications'
import { insurances } from './insurances'
import { licenses } from './licenses'

// Derived from the sibling canonical files — never hardcode license numbers,
// coverage amounts, or award names here. Industry memberships have no other
// home, so this file is their canonical source.
export const credentials = [
  {
    category: 'Licenses & Certifications',
    items: [
      ...licenses.map(l => `Licensed General Contractor (State of California - License #${l.licenseNumber})`),
      ...certifications.map(c => c.label),
    ],
    icon: '📋',
  },
  {
    category: 'Insurance Coverage',
    items: insurances.map(i => `${i.label} - ${i.coverage}`),
    icon: '🛡️',
  },
  {
    category: 'Industry Memberships',
    items: [
      'Better Business Bureau (A+ Rating)',
      'National Association of the Remodeling Industry (NARI)',
      'Associated General Contractors of America (AGC)',
      'U.S. Green Building Council (USGBC)',
      'Home Builders Association',
    ],
    icon: '🏛️',
  },
  {
    category: 'Awards & Recognition',
    items: awards.map(a => a.label),
    icon: '🏆',
  },
]
