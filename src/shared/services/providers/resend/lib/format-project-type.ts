import { services } from '@/shared/constants/company/services'

export function formatProjectType(slug: string): string {
  if (slug === 'other') {
    return 'Other / Not Sure'
  }
  return services.find(s => s.slug === slug)?.title ?? slug
}
