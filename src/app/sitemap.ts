import type { MetadataRoute } from 'next'
import env from '@/config/client-env'
import { navigationItems } from '@/constants/nav-items'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = navigationItems.map(item => item.href)

  return [
    {
      url: env.NEXT_PUBLIC_BASE_URL,
    },
    ...pages.map(page => ({
      url: `${env.NEXT_PUBLIC_BASE_URL}${page}`,
    })),
  ]
}
