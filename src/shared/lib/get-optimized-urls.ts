import { R2_PUBLIC_DOMAINS } from '@/shared/services/r2/buckets'

const DEFAULT_R2_DOMAIN = R2_PUBLIC_DOMAINS['tpr-portfolio-projects'] ?? ''

interface MediaFileInput {
  url: string
  pathKey: string
  bucket: string
  optimizationStatus: string
  optimizationVariants?: string[] | null
}

const VARIANT_WIDTHS: Record<string, number> = {
  sm: 640,
  md: 1280,
  lg: 1920,
}

/** Legacy records optimized before variant tracking was added — assume all 3 exist */
const ALL_VARIANTS = ['sm', 'md', 'lg']

function resolveVariants(file: MediaFileInput): string[] {
  // null/undefined = legacy record, all 3 variants exist on R2
  // [] = explicitly no variants (blur-only / tiny image)
  if (file.optimizationVariants == null) {
    return ALL_VARIANTS
  }
  return file.optimizationVariants
}

/**
 * Returns the best single src for the image.
 * - If optimized with lg variant: uses -lg.webp
 * - If optimized without lg: uses original URL (sharp, even if larger)
 * - If not optimized or blur-only: uses original URL
 */
export function getOptimizedSrc(file: MediaFileInput): string {
  if (file.optimizationStatus !== 'optimized') {
    return file.url
  }

  const variants = resolveVariants(file)

  // Only use a variant as src if lg exists — otherwise original is sharper
  if (variants.includes('lg')) {
    const base = file.pathKey.replace(/\.[^.]+$/, '')
    const domain = R2_PUBLIC_DOMAINS[file.bucket as keyof typeof R2_PUBLIC_DOMAINS] ?? DEFAULT_R2_DOMAIN
    return `${domain}/${base}-lg.webp`
  }

  return file.url
}

/**
 * Returns a srcSet string with optimized variants + original as fallback.
 *
 * When only small variants exist (e.g. ["sm"]), the original URL is included
 * as the high-res option so the browser picks sm for mobile and the original
 * for desktop — avoiding pixelated upscaling.
 */
export function getOptimizedSrcSet(file: MediaFileInput): string | undefined {
  if (file.optimizationStatus !== 'optimized') {
    return undefined
  }

  const variants = resolveVariants(file)
  if (variants.length === 0) {
    return undefined
  }

  const base = file.pathKey.replace(/\.[^.]+$/, '')
  const domain = R2_PUBLIC_DOMAINS[file.bucket as keyof typeof R2_PUBLIC_DOMAINS] ?? DEFAULT_R2_DOMAIN

  const entries = variants
    .filter(s => VARIANT_WIDTHS[s])
    .map(s => `${domain}/${base}-${s}.webp ${VARIANT_WIDTHS[s]}w`)

  // If lg variant is missing, add the original as a high-res fallback.
  // Advertise at the next step above the largest existing variant so
  // the browser uses it for larger viewports without over-fetching on
  // retina displays (declaring 2560w caused retina to always skip sm).
  if (!variants.includes('lg')) {
    const largestVariantWidth = Math.max(...variants.map(s => VARIANT_WIDTHS[s] ?? 0))
    const fallbackWidth = variants.includes('md') ? 1920 : largestVariantWidth > 0 ? 1280 : 1920
    entries.push(`${file.url} ${fallbackWidth}w`)
  }

  return entries.join(', ')
}
