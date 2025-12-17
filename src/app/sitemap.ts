import type { MetadataRoute } from 'next'
import { navigationItems } from '@/constants/nav-items'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = navigationItems.map(item => item.href)

  return [
    {
      // eslint-disable-next-line node/prefer-global/process
      url: process.env.NEXT_PUBLIC_BASE_URL!,
    },
    ...pages.map(page => ({
      // eslint-disable-next-line node/prefer-global/process
      url: `${process.env.NEXT_PUBLIC_BASE_URL}${page}`,
    })),
  ]
}
