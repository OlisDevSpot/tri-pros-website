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

/**
 * Process an image into 3 WebP size variants + blur placeholder.
 * Runs sequentially to reduce peak memory usage on serverless functions.
 */
export async function processImageVariants(originalBuffer: Buffer): Promise<ProcessImageResult> {
  const resizeOpts = { withoutEnlargement: true }
  const webpOpts = { quality: 72 }

  // Sequential to avoid holding 4 large buffers in memory simultaneously
  const sm = await sharp(originalBuffer).resize(640, undefined, resizeOpts).webp(webpOpts).toBuffer()
  const md = await sharp(originalBuffer).resize(1280, undefined, resizeOpts).webp(webpOpts).toBuffer()
  const lg = await sharp(originalBuffer).resize(1920, undefined, resizeOpts).webp(webpOpts).toBuffer()
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
