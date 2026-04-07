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
 * - If optimized with variants: uses the largest available variant
 * - If optimized with NO variants (blur-only / tiny image): uses original URL
 * - If not yet optimized: uses original URL
 */
export function getOptimizedSrc(file: MediaFileInput): string {
  if (file.optimizationStatus !== 'optimized') {
    return file.url
  }

  const variants = resolveVariants(file)
  if (variants.length === 0) {
    return file.url
  }

  // Pick the largest variant available
  const largest = ['lg', 'md', 'sm'].find(s => variants.includes(s))
  if (!largest) {
    return file.url
  }

  const base = file.pathKey.replace(/\.[^.]+$/, '')
  const domain = R2_PUBLIC_DOMAINS[file.bucket as keyof typeof R2_PUBLIC_DOMAINS] ?? DEFAULT_R2_DOMAIN
  return `${domain}/${base}-${largest}.webp`
}

/**
 * Returns a srcSet string referencing only the variants that actually exist.
 * - If no variants were generated, returns undefined (browser uses src only).
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

  return variants
    .filter(s => VARIANT_WIDTHS[s])
    .map(s => `${domain}/${base}-${s}.webp ${VARIANT_WIDTHS[s]}w`)
    .join(', ')
}
