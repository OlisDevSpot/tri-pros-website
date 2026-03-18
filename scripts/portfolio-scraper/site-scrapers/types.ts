import type { MultiProjectResult, ScrapeResult } from '../types'

/**
 * A site-specific scraper handles the unique interaction patterns
 * required to extract project images from a particular website.
 *
 * Each scraper receives a Playwright page that has already been navigated
 * to the target URL, and returns either:
 *   - ScrapeResult (single project — all images belong to one project)
 *   - SiteScraperMultiResult (multiple projects — each with heading + images)
 */
export interface SiteScraper {
  /** Human-readable name shown in logs and prompts */
  name: string

  /**
   * Domain patterns this scraper handles.
   * Matched against the URL's hostname (e.g. 'homeadvisor.com').
   * Supports partial matches — 'homeadvisor.com' matches 'www.homeadvisor.com'.
   */
  domains: string[]

  /** Whether this scraper returns multiple projects per page */
  multiProject: boolean

  /**
   * Run the site-specific scraping logic.
   * Returns ScrapeResult for single-project scrapers,
   * or SiteScraperMultiResult for multi-project scrapers.
   */
  scrape: (opts: SiteScraperOptions) => Promise<ScrapeResult | SiteScraperMultiResult>
}

export interface SiteScraperMultiResult extends MultiProjectResult {
  /** Discriminant so callers can distinguish single vs multi */
  kind: 'multi'
}

export interface SiteScraperOptions {
  url: string
  headful: boolean
  verbose: boolean
  /** Max number of items/projects to scrape (0 = no limit) */
  limit: number
}
