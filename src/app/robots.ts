import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api',
          '/auth',
          '/dashboard',
          '/dev',
          '/intake',
          '/launch',
          '/proposal-flow',
          '/tests',
        ],
      },
    ],
    sitemap: 'https://triprosremodeling.com/sitemap.xml',
    host: 'https://triprosremodeling.com',
  }
}
