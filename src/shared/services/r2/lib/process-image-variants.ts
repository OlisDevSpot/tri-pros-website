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
}

/** Max output sizes per variant — re-encode at lower quality if exceeded */
const SIZE_LIMITS = {
  sm: 80 * 1024, // 80 KB
  md: 200 * 1024, // 200 KB
  lg: 350 * 1024, // 350 KB
} as const

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
 * Process an image into 3 WebP size variants + blur placeholder.
 * Runs sequentially to reduce peak memory usage on serverless functions.
 * Each variant has a max file size — re-encodes at lower quality if exceeded.
 */
export async function processImageVariants(originalBuffer: Buffer): Promise<ProcessImageResult> {
  const sm = await resizeWithBudget(originalBuffer, 640, SIZE_LIMITS.sm)
  const md = await resizeWithBudget(originalBuffer, 1280, SIZE_LIMITS.md)
  const lg = await resizeWithBudget(originalBuffer, 1920, SIZE_LIMITS.lg)
  const blur = await sharp(originalBuffer).resize(20).webp({ quality: 20 }).toBuffer()

  return {
    variants: [
      { suffix: 'sm', buffer: sm, width: 640 },
      { suffix: 'md', buffer: md, width: 1280 },
      { suffix: 'lg', buffer: lg, width: 1920 },
    ],
    blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
  }
}
