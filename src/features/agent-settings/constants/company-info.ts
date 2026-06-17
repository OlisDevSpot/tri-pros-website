import { companyInfo, contactInfo, licenses } from '@/shared/constants/company'

export const COMPANY_INFO = {
  name: companyInfo.name,
  license: `CSLB #${licenses[0].licenseNumber}`,
  phone: contactInfo.find(info => info.accessor === 'phone')!.value,
  email: contactInfo.find(info => info.accessor === 'email')!.value,
  website: 'https://triprosremodeling.com',
} as const

export const USEFUL_LINKS = [
  { label: 'Company Website', href: 'https://triprosremodeling.com', external: true },
  { label: 'Pipedrive CRM', href: 'https://app.pipedrive.com', external: true },
  { label: 'Monday.com', href: 'https://app.monday.com', external: true },
] as const
