import type { MetadataRoute } from 'next'
import process from 'node:process'
import { getTradesByPillar } from '@/features/landing/lib/notion-trade-helpers'
import { getPortfolioProjects } from '@/features/project-management/dal/server/get-portfolio-projects'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://triprosremodeling.com'

// see ./DOCS.md#sitemap-strategy — sitemap is data-driven, not nav-driven.
// Nav serves users; sitemap serves crawlers. Different jobs, different sources
// of truth. Static routes listed here MUST exist as real files in src/app;
// dynamic routes are sourced from the DB + Notion.
export const revalidate = 3600

interface RouteEntry {
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}

const STATIC_ROUTES: RouteEntry[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/experience', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/services', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/services/luxury-renovations', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/services/energy-efficient-construction', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/portfolio', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/portfolio/projects', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/portfolio/testimonials', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/community/commitment', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/community/join', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/blog', changeFrequency: 'daily', priority: 0.8 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }))

  const projectEntries = await loadProjectEntries(now)
  const tradeEntries = await loadTradeEntries(now)

  return [...staticEntries, ...projectEntries, ...tradeEntries]
}

async function loadProjectEntries(now: Date): Promise<MetadataRoute.Sitemap> {
  try {
    const projects = await getPortfolioProjects()
    return projects
      .filter(row => Boolean(row.project.accessor))
      .map(row => ({
        url: `${BASE_URL}/portfolio/projects/${row.project.accessor}`,
        lastModified: row.project.updatedAt ? new Date(row.project.updatedAt) : now,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }))
  }
  catch (error) {
    console.error('[sitemap] Failed to load portfolio projects', error)
    return []
  }
}

async function loadTradeEntries(now: Date): Promise<MetadataRoute.Sitemap> {
  try {
    const [luxuryTrades, energyTrades] = await Promise.all([
      getTradesByPillar('luxury-renovations'),
      getTradesByPillar('energy-efficient-construction'),
    ])
    return [
      ...luxuryTrades.map(trade => ({
        url: `${BASE_URL}/services/luxury-renovations/${trade.slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
      ...energyTrades.map(trade => ({
        url: `${BASE_URL}/services/energy-efficient-construction/${trade.slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
    ]
  }
  catch (error) {
    console.error('[sitemap] Failed to load trades from Notion', error)
    return []
  }
}
