import { chromium } from 'playwright'
import { ALLOWED_EXTENSIONS, SKIP_URL_PATTERNS } from './constants'
import type { MultiProjectGroup, MultiProjectResult, PagesConfig, ScrapeResult, ScrapedImage } from './types'

function shouldSkipUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return SKIP_URL_PATTERNS.some(pattern => lower.includes(pattern))
}

function hasAllowedExtension(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    const lastSegment = pathname.split('/').pop() || ''
    if (!lastSegment.includes('.')) return true
    return ALLOWED_EXTENSIONS.some(ext => lastSegment.endsWith(`.${ext}`))
  }
  catch {
    return false
  }
}

function normalizeUrl(url: string, baseUrl: string): string | null {
  try {
    if (!url || url.trim().length === 0) return null
    if (url.startsWith('data:')) return null
    if (url.startsWith('//')) return `https:${url}`
    if (url.startsWith('http')) return url
    return new URL(url, baseUrl).href
  }
  catch {
    return null
  }
}

/**
 * Extract a "base image identity" from a URL by stripping resolution suffixes.
 * Catches: image-300x200.jpg vs image-1200x800.jpg, image.jpg?w=300 vs ?w=1200
 */
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

// All page.evaluate calls use plain JS string literals to avoid esbuild/tsx
// injecting __name() helpers that don't exist in the browser context.

const EXTRACT_IMAGES_SCRIPT = /* js */ `
  var urls = [];

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

  // 1. img elements
  var imgs = Array.from(document.querySelectorAll('img'));
  for (var i = 0; i < imgs.length; i++) {
    var img = imgs[i];
    var srcset = img.srcset || img.getAttribute('data-srcset') || '';
    var bestSrcset = pickLargest(srcset);
    if (bestSrcset) {
      urls.push({ url: bestSrcset, alt: img.alt || '', source: 'img-srcset-best' });
    } else {
      var src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src')
        || img.getAttribute('data-original') || img.getAttribute('data-bg') || '';
      if (src) urls.push({ url: src, alt: img.alt || '', source: 'img-src' });
    }
  }

  // 2. picture > source
  var sources = Array.from(document.querySelectorAll('picture source'));
  for (var i = 0; i < sources.length; i++) {
    var srcset = sources[i].getAttribute('srcset') || '';
    var best = pickLargest(srcset);
    if (best) urls.push({ url: best, source: 'picture-source-best' });
  }

  // 3. a tags linking to images
  var anchors = Array.from(document.querySelectorAll('a[href]'));
  for (var i = 0; i < anchors.length; i++) {
    var href = anchors[i].getAttribute('href') || '';
    if (/\\.(jpg|jpeg|png|webp)(\\?|$)/i.test(href)) {
      urls.push({ url: href, source: 'a-href' });
    }
  }

  // 4. data-* image attributes on non-img elements
  var dataAttrs = ['data-src', 'data-image', 'data-full', 'data-large',
    'data-original', 'data-bg', 'data-background-image', 'data-hi-res'];
  var dataEls = Array.from(document.querySelectorAll(
    '[data-src],[data-image],[data-full],[data-large],[data-original],[data-bg],[data-background-image],[data-hi-res]'
  ));
  for (var i = 0; i < dataEls.length; i++) {
    if (dataEls[i].tagName === 'IMG') continue;
    for (var j = 0; j < dataAttrs.length; j++) {
      var val = dataEls[i].getAttribute(dataAttrs[j]);
      if (val && val.indexOf('data:') !== 0) {
        urls.push({ url: val, source: 'data-attr:' + dataAttrs[j] });
      }
    }
  }

  // 5. CSS background-image
  var allEls = Array.from(document.querySelectorAll('*'));
  for (var i = 0; i < allEls.length; i++) {
    var style = window.getComputedStyle(allEls[i]);
    var bgImg = style.backgroundImage;
    if (bgImg && bgImg !== 'none') {
      var re = /url\\(["']?(.*?)["']?\\)/g;
      var match;
      while ((match = re.exec(bgImg)) !== null) {
        if (match[1]) urls.push({ url: match[1], source: 'bg-image' });
      }
    }
  }

  urls;
`

const EXTRACT_METADATA_SCRIPT = /* js */ `
  var title = document.title || '';
  var metaDesc = document.querySelector('meta[name="description"]');
  var description = metaDesc ? (metaDesc.getAttribute('content') || '') : '';
  var bodyText = document.body.innerText.slice(0, 2000);
  ({ title: title, description: description, bodyText: bodyText });
`

const AUTO_SCROLL_SCRIPT = /* js */ `
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
`

export async function scrapeImages(
  url: string,
  headful: boolean = false,
  verbose: boolean = false,
): Promise<ScrapeResult> {
  const browser = await chromium.launch({ headless: !headful })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  const log = verbose
    ? (msg: string) => console.log(`  [VERBOSE] ${msg}`)
    : (_msg: string) => {}

  try {
    console.log(`  Navigating to ${url}...`)
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })

    await dismissPopups(page, log)

    console.log('  Scrolling to load lazy images...')
    await page.evaluate(AUTO_SCROLL_SCRIPT)
    await page.waitForTimeout(2000)

    const rawUrls: Array<{ url: string, alt?: string, source: string }> =
      await page.evaluate(EXTRACT_IMAGES_SCRIPT)

    log(`Raw URLs extracted: ${rawUrls.length}`)

    const metadata: { title: string, description: string, bodyText: string } =
      await page.evaluate(EXTRACT_METADATA_SCRIPT)

    // ---- FILTER AND DEDUPLICATE ----

    const seen = new Set<string>()
    const images: ScrapedImage[] = []
    let skippedEmpty = 0
    let skippedNormalize = 0
    let skippedDuplicate = 0
    let skippedPattern = 0
    let skippedExtension = 0

    for (const raw of rawUrls) {
      if (!raw.url || raw.url.trim().length === 0) {
        skippedEmpty++
        continue
      }

      const normalized = normalizeUrl(raw.url, url)
      if (!normalized) {
        skippedNormalize++
        log(`  SKIP normalize: ${raw.url}`)
        continue
      }

      const dedupeKey = getImageBaseKey(normalized)

      if (seen.has(dedupeKey)) {
        skippedDuplicate++
        log(`  SKIP duplicate (base: ${dedupeKey}): ${normalized}`)
        continue
      }

      if (shouldSkipUrl(normalized)) {
        skippedPattern++
        log(`  SKIP pattern: ${normalized}`)
        continue
      }

      if (!hasAllowedExtension(normalized)) {
        skippedExtension++
        log(`  SKIP extension: ${normalized}`)
        continue
      }

      seen.add(dedupeKey)
      images.push({
        url: normalized,
        alt: raw.alt,
      })
      log(`  KEEP [${raw.source}]: ${normalized}`)
    }

    console.log(`  Found ${images.length} candidate images (from ${rawUrls.length} raw URLs)`)
    if (verbose) {
      console.log(`  Filter stats: empty=${skippedEmpty} normalize=${skippedNormalize} duplicate=${skippedDuplicate} pattern=${skippedPattern} extension=${skippedExtension}`)
    }

    return { images, metadata }
  }
  finally {
    await browser.close()
  }
}

/**
 * Browser script that extracts project groups from a page.
 * Each group = a container with a heading (h2/h3) + descendant images.
 * Accepts a CSS selector override; 'auto' tries common patterns.
 */
function buildExtractGroupsScript(selector: string): string {
  // When selector is 'auto', we look for sections/divs that contain
  // both a heading (h2 or h3) and at least one img.
  const selectorJs = selector === 'auto'
    ? `
      // Auto-detect: find all h2/h3 elements, then walk up to their parent container
      var headings = Array.from(document.querySelectorAll('h2, h3'));
      var containers = [];
      for (var i = 0; i < headings.length; i++) {
        var parent = headings[i].parentElement;
        if (!parent) continue;
        // Walk up at most 2 levels to find a container with images
        for (var depth = 0; depth < 3; depth++) {
          if (!parent) break;
          var imgs = parent.querySelectorAll('img');
          if (imgs.length >= 1) {
            containers.push({ el: parent, heading: headings[i] });
            break;
          }
          parent = parent.parentElement;
        }
      }
    `
    : `
      var sections = Array.from(document.querySelectorAll('${selector.replace(/'/g, "\\'")}'));
      var containers = [];
      for (var i = 0; i < sections.length; i++) {
        var heading = sections[i].querySelector('h1, h2, h3, h4');
        if (heading) {
          containers.push({ el: sections[i], heading: heading });
        } else {
          containers.push({ el: sections[i], heading: null });
        }
      }
    `

  return /* js */ `
    (function() {
      ${selectorJs}

      // Deduplicate containers (a child heading might resolve to the same parent)
      var seen = new Set();
      var unique = [];
      for (var i = 0; i < containers.length; i++) {
        if (seen.has(containers[i].el)) continue;
        seen.add(containers[i].el);
        unique.push(containers[i]);
      }

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

      var groups = [];
      for (var i = 0; i < unique.length; i++) {
        var container = unique[i];
        var headingText = container.heading ? container.heading.innerText.trim() : 'Group ' + (i + 1);
        var imgs = Array.from(container.el.querySelectorAll('img'));
        var urls = [];
        for (var j = 0; j < imgs.length; j++) {
          var img = imgs[j];
          var srcset = img.srcset || img.getAttribute('data-srcset') || '';
          var bestSrcset = pickLargest(srcset);
          if (bestSrcset) {
            urls.push({ url: bestSrcset, alt: img.alt || '' });
          } else {
            var src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src')
              || img.getAttribute('data-original') || '';
            if (src) urls.push({ url: src, alt: img.alt || '' });
          }
        }

        // Also check a[href] pointing to images inside the container
        var anchors = Array.from(container.el.querySelectorAll('a[href]'));
        for (var j = 0; j < anchors.length; j++) {
          var href = anchors[j].getAttribute('href') || '';
          if (/\\.(jpg|jpeg|png|webp)(\\?|$)/i.test(href)) {
            urls.push({ url: href, alt: '' });
          }
        }

        if (urls.length > 0) {
          groups.push({ heading: headingText, images: urls });
        }
      }

      return groups;
    })();
  `
}

/**
 * Scrape a single page that contains MULTIPLE projects grouped in the DOM.
 * Returns an array of groups, each with a heading and its images.
 */
export async function scrapeMultiProjectPage(
  url: string,
  selector: string,
  headful: boolean = false,
  verbose: boolean = false,
): Promise<MultiProjectResult> {
  const browser = await chromium.launch({ headless: !headful })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  const log = verbose
    ? (msg: string) => console.log(`  [VERBOSE] ${msg}`)
    : (_msg: string) => {}

  try {
    console.log(`  Navigating to ${url}...`)
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })

    await dismissPopups(page, log)

    console.log('  Scrolling to load lazy images...')
    await page.evaluate(AUTO_SCROLL_SCRIPT)
    await page.waitForTimeout(2000)

    const metadata: { title: string, description: string, bodyText: string } =
      await page.evaluate(EXTRACT_METADATA_SCRIPT)

    const rawGroups: Array<{ heading: string, images: Array<{ url: string, alt?: string }> }> =
      await page.evaluate(buildExtractGroupsScript(selector))

    log(`Raw groups found: ${rawGroups.length}`)

    // Filter and deduplicate images within each group
    const groups: MultiProjectGroup[] = []

    for (const rawGroup of rawGroups) {
      const seen = new Set<string>()
      const images: ScrapedImage[] = []

      for (const raw of rawGroup.images) {
        if (!raw.url || raw.url.trim().length === 0) continue

        const normalized = normalizeUrl(raw.url, url)
        if (!normalized) continue

        const dedupeKey = getImageBaseKey(normalized)
        if (seen.has(dedupeKey)) continue
        if (shouldSkipUrl(normalized)) continue
        if (!hasAllowedExtension(normalized)) continue

        seen.add(dedupeKey)
        images.push({ url: normalized, alt: raw.alt })
      }

      if (images.length > 0) {
        groups.push({ heading: rawGroup.heading, images })
        log(`  Group "${rawGroup.heading}": ${images.length} images`)
      }
    }

    console.log(`  Found ${groups.length} project groups with images`)
    return { groups, metadata }
  }
  finally {
    await browser.close()
  }
}

/**
 * Scrape a paginated project — visits multiple URLs (e.g. ?page=1, ?page=2)
 * and merges all images into a single ScrapeResult.
 */
export async function scrapePaginatedImages(
  baseUrl: string,
  pagesConfig: PagesConfig,
  headful: boolean = false,
  verbose: boolean = false,
): Promise<ScrapeResult> {
  const allImages: ScrapedImage[] = []
  const globalSeen = new Set<string>()
  let metadata: ScrapeResult['metadata'] = {}

  for (const pageNum of pagesConfig.pageNumbers) {
    const pageUrl = new URL(baseUrl)
    pageUrl.searchParams.set(pagesConfig.param, String(pageNum))
    const urlStr = pageUrl.toString()

    console.log(`  Scraping page ${pageNum}: ${urlStr}`)
    const result = await scrapeImages(urlStr, headful, verbose)

    // Use metadata from first page
    if (pageNum === pagesConfig.pageNumbers[0]) {
      metadata = result.metadata
    }

    // Merge images, deduplicating across pages
    for (const img of result.images) {
      const dedupeKey = getImageBaseKey(img.url)
      if (!globalSeen.has(dedupeKey)) {
        globalSeen.add(dedupeKey)
        allImages.push(img)
      }
    }

    console.log(`  Page ${pageNum}: ${result.images.length} images (${allImages.length} total unique)`)
  }

  return { images: allImages, metadata }
}

async function dismissPopups(
  page: import('playwright').Page,
  log: (msg: string) => void,
): Promise<void> {
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
    '.modal-close',
    '.popup-close',
    '[class*="overlay"] button',
    '[class*="dismiss"]',
  ]

  for (const selector of dismissSelectors) {
    try {
      const el = page.locator(selector).first()
      if (await el.isVisible({ timeout: 500 })) {
        await el.click({ timeout: 1000 })
        log(`Dismissed popup via: ${selector}`)
        await page.waitForTimeout(500)
      }
    }
    catch {
      // Expected — most selectors won't match
    }
  }
}
