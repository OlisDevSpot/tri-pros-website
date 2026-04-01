import type { MultiProjectGroup, ScrapedImage } from '../types'
import type { SiteScraper, SiteScraperMultiResult, SiteScraperOptions } from './types'
import { ALLOWED_EXTENSIONS, SKIP_URL_PATTERNS } from '../constants'
import { launchStealthBrowser } from '../scrape-images'

/**
 * HomeAdvisor scraper.
 *
 * The profile page shows a carousel of project thumbnails inside a `<ul>`.
 * Each `<li>` contains a `<div role="button">` that opens a lightbox/dialog
 * with full-size project photos. There's no URL change — it's pure UI state.
 *
 * Strategy:
 *   1. Navigate and dismiss popups/cookie banners
 *   2. Scroll to the photo carousel section
 *   3. Collect all carousel items (li elements with role="button" divs)
 *   4. For each item: click -> wait for dialog -> scrape dialog images -> close dialog
 *   5. Deduplicate across all dialogs and return
 */

function shouldSkipUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return SKIP_URL_PATTERNS.some(pattern => lower.includes(pattern))
}

function hasAllowedExtension(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    const lastSegment = pathname.split('/').pop() || ''
    if (!lastSegment.includes('.'))
      return true
    return ALLOWED_EXTENSIONS.some(ext => lastSegment.endsWith(`.${ext}`))
  }
  catch {
    return false
  }
}

function normalizeUrl(url: string, baseUrl: string): string | null {
  try {
    if (!url || url.trim().length === 0)
      return null
    if (url.startsWith('data:'))
      return null
    if (url.startsWith('//'))
      return `https:${url}`
    if (url.startsWith('http'))
      return url
    return new URL(url, baseUrl).href
  }
  catch {
    return null
  }
}

function getImageBaseKey(urlStr: string): string {
  try {
    const parsed = new URL(urlStr)
    let pathname = parsed.pathname
    pathname = pathname.replace(/[-_]\d{2,4}x\d{2,4}(?=\.\w+$)/, '')
    pathname = pathname.replace(/-(scaled|rotated)(?=\.\w+$)/, '')
    return parsed.origin + pathname
  }
  catch {
    return urlStr
  }
}

const EXTRACT_METADATA_SCRIPT = /* js */ `
  var title = document.title || '';
  var metaDesc = document.querySelector('meta[name="description"]');
  var description = metaDesc ? (metaDesc.getAttribute('content') || '') : '';
  var bodyText = document.body.innerText.slice(0, 2000);
  ({ title: title, description: description, bodyText: bodyText });
`

async function scrapeHomeAdvisor(opts: SiteScraperOptions): Promise<SiteScraperMultiResult> {
  const { url, headful, verbose } = opts

  const log = verbose
    ? (msg: string) => console.log(`  [HA] ${msg}`)
    : (_msg: string) => {}

  const { browser, page } = await launchStealthBrowser(headful)

  try {
    console.log(`  [HomeAdvisor] Navigating to ${url}...`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    // Wait for network to settle (but don't fail if it doesn't fully idle)
    await page.waitForLoadState('networkidle').catch(() => {
      console.log('  [HomeAdvisor] Network didn\'t fully idle — continuing anyway')
    })

    // Dismiss cookie banners / popups
    const dismissSelectors = [
      'button:has-text("Accept")',
      'button:has-text("Got it")',
      'button:has-text("I agree")',
      'button:has-text("OK")',
      '[class*="cookie"] button',
      '[id*="cookie"] button',
      '[aria-label="Close"]',
      '[aria-label="close"]',
      'button[class*="close"]',
    ]

    for (const sel of dismissSelectors) {
      try {
        const el = page.locator(sel).first()
        if (await el.isVisible({ timeout: 500 })) {
          await el.click({ timeout: 1000 })
          log(`Dismissed popup via: ${sel}`)
          await page.waitForTimeout(500)
        }
      }
      catch {
        // Expected
      }
    }

    // Scroll the page to ensure carousel section is loaded
    console.log('  [HomeAdvisor] Scrolling page to load content...')
    await page.evaluate(/* js */ `
      new Promise(function(resolve) {
        var totalHeight = 0;
        var distance = 400;
        var timer = setInterval(function() {
          var scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 200);
        setTimeout(function() {
          clearInterval(timer);
          resolve();
        }, 15000);
      });
    `)
    await page.waitForTimeout(1000)

    // Extract page metadata
    const metadata: { title: string, description: string, bodyText: string }
      = await page.evaluate(EXTRACT_METADATA_SCRIPT)

    // Find all carousel buttons
    // HomeAdvisor uses: ul > li > div[role="button"]
    const carouselButtons = page.locator('ul li div[role="button"]')
    const buttonCount = await carouselButtons.count()

    const itemsToScrape = opts.limit > 0 ? Math.min(buttonCount, opts.limit) : buttonCount
    console.log(`  [HomeAdvisor] Found ${buttonCount} carousel items${opts.limit > 0 ? ` (scraping first ${itemsToScrape})` : ''}`)

    if (buttonCount === 0) {
      console.warn('  [HomeAdvisor] No carousel buttons found. Falling back to standard image extraction.')
      const fallbackImages = await extractVisibleImages(page, url, log)
      return {
        kind: 'multi',
        groups: [{ heading: metadata.title || 'Unknown Project', images: fallbackImages }],
        metadata,
      }
    }

    // Each carousel item = a separate project
    const groups: MultiProjectGroup[] = []

    for (let i = 0; i < itemsToScrape; i++) {
      log(`Processing carousel item ${i + 1}/${itemsToScrape}...`)

      const button = carouselButtons.nth(i)

      try {
        await button.scrollIntoViewIfNeeded({ timeout: 3000 })
        await page.waitForTimeout(300)
        await button.click({ timeout: 5000 })
      }
      catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        log(`Could not click item ${i + 1}: ${msg}`)
        continue
      }

      // Wait for dialog/modal to appear
      await waitForDialog(page, log)
      await page.waitForTimeout(800)

      // Extract the project title from the dialog's h1
      const dialogTitle: string = await page.evaluate(/* js */ `
        (function() {
          var selectors = ['[role="dialog"] h1', '[class*="modal"] h1', 'h1'];
          for (var i = 0; i < selectors.length; i++) {
            var el = document.querySelector(selectors[i]);
            if (el && el.offsetParent !== null) {
              var text = el.innerText.trim();
              if (text.length > 0) return text;
            }
          }
          return '';
        })();
      `)

      const heading = dialogTitle || `Project ${i + 1}`
      log(`  Dialog title: "${heading}"`)

      // Scrape all full-size images from this dialog (per-project dedup only)
      const projectSeen = new Set<string>()
      const projectImages = await scrapeDialogThumbnails(page, url, projectSeen, log)

      if (projectImages.length > 0) {
        groups.push({ heading, images: projectImages })
      }

      console.log(`    Item ${i + 1}/${itemsToScrape}: "${heading}" — ${projectImages.length} images`)

      // Close the dialog
      await closeDialog(page, log)
      await page.waitForTimeout(500)
    }

    console.log(`  [HomeAdvisor] Scraped ${groups.length} projects with ${groups.reduce((s, g) => s + g.images.length, 0)} total images`)
    return { kind: 'multi', groups, metadata }
  }
  finally {
    await browser.close()
  }
}

/** Wait for any dialog/modal to appear on the page */
async function waitForDialog(
  page: import('playwright').Page,
  log: (msg: string) => void,
): Promise<void> {
  const dialogSelectors = [
    '[role="dialog"]',
    '[class*="modal"]:not([class*="cookie"])',
    '[class*="lightbox"]',
    '[class*="overlay"][class*="photo"]',
    '[class*="gallery-viewer"]',
    '[class*="viewer"]',
  ]

  for (const sel of dialogSelectors) {
    try {
      await page.waitForSelector(sel, { state: 'visible', timeout: 3000 })
      log(`Dialog appeared via: ${sel}`)
      return
    }
    catch {
      // Try next
    }
  }

  log('No dialog detected -- waiting for UI state change')
  await page.waitForTimeout(1000)
}

/**
 * Browser script: find the single largest visible image on the page.
 * After clicking a thumbnail, the full-size image should be the biggest
 * visible <img> currently on screen.
 */
const EXTRACT_LARGEST_IMAGE_SCRIPT = /* js */ `
  (function() {
    var pickLargest = function(srcset) {
      if (!srcset) return null;
      var best = '';
      var bestValue = 0;
      var entries = srcset.split(',');
      for (var i = 0; i < entries.length; i++) {
        var parts = entries[i].trim().split(/\\s+/);
        var entryUrl = parts[0];
        var descriptor = parts[1] || '0w';
        var value = parseInt(descriptor) || 0;
        if (!best || value > bestValue) {
          best = entryUrl;
          bestValue = value;
        }
      }
      return best || null;
    };

    var best = null;
    var bestArea = 0;

    var imgs = Array.from(document.querySelectorAll('img'));
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var rect = img.getBoundingClientRect();
      var area = rect.width * rect.height;

      // Must be visible and on-screen
      if (rect.width < 200 || rect.height < 200) continue;
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

      if (area > bestArea) {
        var srcset = img.srcset || img.getAttribute('data-srcset') || '';
        var bestSrcset = pickLargest(srcset);
        var src = bestSrcset
          || img.src
          || img.getAttribute('data-src')
          || img.getAttribute('data-original')
          || img.getAttribute('data-lazy-src')
          || img.currentSrc
          || '';

        if (src) {
          bestArea = area;
          best = { url: src, alt: img.alt || '', w: rect.width, h: rect.height };
        }
      }
    }

    return best;
  })();
`

/**
 * Scrape all images from an open HomeAdvisor dialog.
 *
 * HomeAdvisor dialog pattern:
 *   - A large main/preview image at the top
 *   - A horizontal thumbnail strip below it
 *   - Clicking a thumbnail SWAPS the main preview (no navigation, no Escape needed)
 *
 * Strategy:
 *   1. Grab the initial preview image
 *   2. Find all small images in the dialog (thumbnail strip)
 *   3. Click each thumbnail sequentially — the main image swaps in place
 *   4. After each click, grab the new largest image
 *   5. Deduplicate via globalSeen
 *
 * If no thumbnail strip is found, fall back to just grabbing the preview.
 */
async function scrapeDialogThumbnails(
  page: import('playwright').Page,
  baseUrl: string,
  globalSeen: Set<string>,
  log: (msg: string) => void,
): Promise<ScrapedImage[]> {
  const newImages: ScrapedImage[] = []

  /** Helper: grab the largest visible image and add it if new */
  const collectLargestImage = async (): Promise<boolean> => {
    const img: { url: string, alt: string, w: number, h: number } | null
      = await page.evaluate(EXTRACT_LARGEST_IMAGE_SCRIPT)
    if (!img)
      return false

    const normalized = normalizeUrl(img.url, baseUrl)
    if (!normalized)
      return false

    const dedupeKey = getImageBaseKey(normalized)
    if (globalSeen.has(dedupeKey) || shouldSkipUrl(normalized) || !hasAllowedExtension(normalized)) {
      log(`    skip (seen/filtered): ${normalized.slice(0, 80)}`)
      return false
    }

    globalSeen.add(dedupeKey)
    newImages.push({ url: normalized, alt: img.alt })
    log(`    KEEP [${img.w}x${img.h}]: ${normalized}`)
    return true
  }

  // 1. Collect the initial preview image
  await collectLargestImage()

  // 2. Find all visible images on the page, partition into "main" vs "thumbnails".
  //    We do this via page.evaluate to get accurate bounding boxes from the browser,
  //    then use the absolute DOM index to click via page.locator('img').nth(N).
  //    This avoids the problem of Playwright's compound CSS selectors picking hidden containers.
  const imgInfos: Array<{ pageIndex: number, width: number, height: number, area: number }>
    = await page.evaluate(/* js */ `
      (function() {
        var results = [];
        var imgs = Array.from(document.querySelectorAll('img'));
        for (var i = 0; i < imgs.length; i++) {
          var rect = imgs[i].getBoundingClientRect();
          if (rect.width < 10 || rect.height < 10) continue;
          if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
          results.push({
            pageIndex: i,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            area: Math.round(rect.width * rect.height)
          });
        }
        return results;
      })();
    `)

  log(`  ${imgInfos.length} visible images on page while dialog is open`)

  if (imgInfos.length <= 1) {
    log('  Only 1 visible image — no thumbnails to iterate')
    return newImages
  }

  // Sort by area descending — largest is the main preview
  imgInfos.sort((a, b) => b.area - a.area)
  const mainPreviewArea = imgInfos[0].area
  log(`  Main preview: ${imgInfos[0].width}x${imgInfos[0].height} (area ${mainPreviewArea})`)

  // Thumbnails: everything significantly smaller than the main preview
  const thumbnails = imgInfos.filter(i => i.area < mainPreviewArea * 0.4)
  log(`  Identified ${thumbnails.length} thumbnails (< 40% of main area)`)

  if (thumbnails.length === 0) {
    // Fallback: everything except the single largest
    const fallback = imgInfos.slice(1).filter(i => i.area < mainPreviewArea * 0.9)
    log(`  Fallback: ${fallback.length} non-main images`)
    thumbnails.push(...fallback)
  }

  if (thumbnails.length === 0) {
    log('  No thumbnails found to iterate')
    return newImages
  }

  // 3. Click each thumbnail by its absolute page index, wait for preview swap, collect
  let collected = newImages.length
  for (let t = 0; t < thumbnails.length; t++) {
    const thumb = thumbnails[t]
    log(`  Clicking thumb ${t + 1}/${thumbnails.length} (${thumb.width}x${thumb.height}, pageIndex=${thumb.pageIndex})...`)

    try {
      const thumbLocator = page.locator('img').nth(thumb.pageIndex)

      await thumbLocator.scrollIntoViewIfNeeded({ timeout: 2000 })
      await page.waitForTimeout(150)
      await thumbLocator.click({ timeout: 3000 })

      // Wait for the main preview to swap
      await page.waitForTimeout(600)

      const got = await collectLargestImage()
      if (got)
        collected++
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log(`    Error clicking thumb ${t + 1}: ${msg}`)
      continue
    }
  }

  log(`  Dialog total: ${collected} images collected`)
  return newImages
}

/** Try various strategies to close the open dialog */
async function closeDialog(
  page: import('playwright').Page,
  log: (msg: string) => void,
): Promise<void> {
  const closeSelectors = [
    '[role="dialog"] [aria-label="Close"]',
    '[role="dialog"] [aria-label="close"]',
    '[role="dialog"] button[class*="close"]',
    '[class*="modal"] [aria-label="Close"]',
    '[class*="modal"] [aria-label="close"]',
    '[class*="modal"] button[class*="close"]',
    '[class*="lightbox"] [aria-label="Close"]',
    '[class*="lightbox"] button[class*="close"]',
    'button[aria-label="Close"]',
    'button[aria-label="close"]',
    '[class*="overlay"] button[class*="close"]',
    'button:has-text("Close")',
    'button:has-text("close")',
  ]

  for (const sel of closeSelectors) {
    try {
      const el = page.locator(sel).first()
      if (await el.isVisible({ timeout: 500 })) {
        await el.click({ timeout: 1000 })
        log(`Closed dialog via: ${sel}`)
        await page.waitForTimeout(300)
        return
      }
    }
    catch {
      // Try next
    }
  }

  // Fallback: press Escape
  try {
    await page.keyboard.press('Escape')
    log('Closed dialog via Escape key')
    await page.waitForTimeout(300)
  }
  catch {
    log('Could not close dialog -- continuing anyway')
  }
}

/** Fallback: extract all visible images from the page (no dialog interaction) */
async function extractVisibleImages(
  page: import('playwright').Page,
  baseUrl: string,
  log: (msg: string) => void,
): Promise<ScrapedImage[]> {
  const rawUrls: Array<{ url: string, alt?: string, source: string }> = await page.evaluate(/* js */ `
    var urls = [];
    var imgs = Array.from(document.querySelectorAll('img'));
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var src = img.src || img.getAttribute('data-src') || '';
      if (src) urls.push({ url: src, alt: img.alt || '', source: 'fallback-img' });
    }
    urls;
  `)

  const images: ScrapedImage[] = []
  const seen = new Set<string>()

  for (const raw of rawUrls) {
    const normalized = normalizeUrl(raw.url, baseUrl)
    if (!normalized)
      continue
    const key = getImageBaseKey(normalized)
    if (seen.has(key))
      continue
    if (shouldSkipUrl(normalized))
      continue
    if (!hasAllowedExtension(normalized))
      continue
    seen.add(key)
    images.push({ url: normalized, alt: raw.alt })
    log(`KEEP [fallback]: ${normalized}`)
  }

  return images
}

export const homeAdvisorScraper: SiteScraper = {
  name: 'homeadvisor',
  domains: ['homeadvisor.com'],
  multiProject: true,
  scrape: scrapeHomeAdvisor,
}
