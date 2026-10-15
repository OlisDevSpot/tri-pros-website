import { companyInfo } from '@/shared/constants/company'

export const COMPANY_PHONE = companyInfo.contactInfo.find(info => info.accessor === 'phone')?.value
