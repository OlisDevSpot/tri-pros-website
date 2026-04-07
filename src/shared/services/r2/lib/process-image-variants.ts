import type { Buffer } from 'node:buffer'

import sharp from 'sharp'

export interface ImageVariant {
  suffix: string
  buffer: Buffer
  width: number
}

export interface ProcessImageResult {
  variants: ImageVariant[]
  blurDataUrl: string
  /** Which variant suffixes were actually generated (e.g. ['sm','md','lg'] or ['sm'] or []) */
  variantSuffixes: string[]
  /** Diagnostic info about skip decisions — useful for migration script logging */
  decisions: VariantDecision[]
}

export interface VariantDecision {
  suffix: string
  targetWidth: number
  action: 'generated' | 'skipped'
  reason?: string
}

/** Variant definitions: suffix → target width */
const VARIANT_DEFS = [
  { suffix: 'sm', width: 640 },
  { suffix: 'md', width: 1280 },
  { suffix: 'lg', width: 1920 },
] as const

/** Max output sizes per variant — re-encode at lower quality if exceeded */
const SIZE_LIMITS: Record<string, number> = {
  sm: 80 * 1024, // 80 KB
  md: 200 * 1024, // 200 KB
  lg: 350 * 1024, // 350 KB
}

/**
 * Minimum downscale ratio to justify creating a variant.
 * If the original width is less than targetWidth × this factor,
 * we skip — there's not enough resolution to meaningfully downscale.
 */
const MIN_DOWNSCALE_FACTOR = 1.2

/**
 * If the original file is already smaller than this, skip ALL variants
 * and just generate blur. The original is already well-optimized.
 */
const TINY_IMAGE_THRESHOLD = 50 * 1024 // 50 KB

const RESIZE_OPTS = { withoutEnlargement: true }
const INITIAL_QUALITY = 72
const FALLBACK_QUALITY = 55

/**
 * Resize + compress to WebP. If output exceeds the size limit,
 * re-encode at a lower quality to stay within budget.
 */
async function resizeWithBudget(
  input: Buffer,
  width: number,
  maxBytes: number,
): Promise<Buffer> {
  const first = await sharp(input)
    .resize(width, undefined, RESIZE_OPTS)
    .webp({ quality: INITIAL_QUALITY })
    .toBuffer()

  if (first.byteLength <= maxBytes) {
    return first
  }

  // Over budget — re-encode at lower quality
  return sharp(input)
    .resize(width, undefined, RESIZE_OPTS)
    .webp({ quality: FALLBACK_QUALITY })
    .toBuffer()
}

/**
 * Process an image into WebP size variants + blur placeholder.
 *
 * Smart threshold logic:
 * 1. Tiny originals (<50KB) — blur only, no variants. Original is already small enough.
 * 2. Per-variant: skip if original width < targetWidth × 1.2 — not enough pixels to downscale.
 * 3. Per-variant: skip if original file size is already below the variant's size budget.
 * 4. Blur is always generated (20px wide, ~200 bytes).
 *
 * Runs variants sequentially to reduce peak memory usage on serverless functions.
 */
export async function processImageVariants(originalBuffer: Buffer): Promise<ProcessImageResult> {
  const metadata = await sharp(originalBuffer).metadata()
  const originalWidth = metadata.width ?? 0
  const originalSize = originalBuffer.byteLength

  const decisions: VariantDecision[] = []
  const variants: ImageVariant[] = []

  // Tiny image — skip all variants, just generate blur
  if (originalSize <= TINY_IMAGE_THRESHOLD) {
    for (const def of VARIANT_DEFS) {
      decisions.push({
        suffix: def.suffix,
        targetWidth: def.width,
        action: 'skipped',
        reason: `original ${Math.round(originalSize / 1024)}KB is below tiny threshold (${TINY_IMAGE_THRESHOLD / 1024}KB)`,
      })
    }
  }
  else {
    for (const def of VARIANT_DEFS) {
      // Skip if original isn't wide enough to meaningfully downscale
      if (originalWidth < def.width * MIN_DOWNSCALE_FACTOR) {
        decisions.push({
          suffix: def.suffix,
          targetWidth: def.width,
          action: 'skipped',
          reason: `original ${originalWidth}px wide < ${def.width}×${MIN_DOWNSCALE_FACTOR} = ${Math.round(def.width * MIN_DOWNSCALE_FACTOR)}px threshold`,
        })
        continue
      }

      // Skip if original is already smaller than this variant's size budget
      const sizeLimit = SIZE_LIMITS[def.suffix]
      if (sizeLimit && originalSize <= sizeLimit) {
        decisions.push({
          suffix: def.suffix,
          targetWidth: def.width,
          action: 'skipped',
          reason: `original ${Math.round(originalSize / 1024)}KB already under ${def.suffix} budget (${sizeLimit / 1024}KB)`,
        })
        continue
      }

      const buffer = await resizeWithBudget(originalBuffer, def.width, sizeLimit ?? Infinity)
      variants.push({ suffix: def.suffix, buffer, width: def.width })
      decisions.push({ suffix: def.suffix, targetWidth: def.width, action: 'generated' })
    }
  }

  // Always generate blur placeholder
  const blur = await sharp(originalBuffer).resize(20).webp({ quality: 20 }).toBuffer()

  return {
    variants,
    blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
    variantSuffixes: variants.map(v => v.suffix),
    decisions,
  }
}
