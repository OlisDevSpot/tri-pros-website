import type { SiteScraper } from './types'

// ── Auto-register all scrapers on import ──────────────────────────
// Add new scraper imports here:
import { homeAdvisorScraper } from './homeadvisor'

/**
 * Registry of site-specific scrapers.
 * Add new scrapers here — they'll be auto-matched by domain or --source flag.
 */
const scrapers: SiteScraper[] = []

export function registerScraper(scraper: SiteScraper): void {
  scrapers.push(scraper)
}

/**
 * Find a scraper by explicit source name (case-insensitive).
 * Matches against the scraper's `name` field.
 */
export function findScraperByName(name: string): SiteScraper | null {
  const lower = name.toLowerCase()
  return scrapers.find(s => s.name.toLowerCase() === lower) ?? null
}

/**
 * Auto-detect a scraper by matching the URL's hostname against
 * each scraper's domain patterns.
 */
export function findScraperByUrl(url: string): SiteScraper | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return scrapers.find(s =>
      s.domains.some(domain => hostname.includes(domain.toLowerCase())),
    ) ?? null
  }
  catch {
    return null
  }
}

/** List all registered scrapers (for --help / prompts) */
export function listScrapers(): SiteScraper[] {
  return [...scrapers]
}

registerScraper(homeAdvisorScraper)
