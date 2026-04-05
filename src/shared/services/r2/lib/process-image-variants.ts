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

export async function processImageVariants(originalBuffer: Buffer): Promise<ProcessImageResult> {
  const resizeOpts = { withoutEnlargement: true }
  const webpOpts = { quality: 72 }

  const [sm, md, lg, blur] = await Promise.all([
    sharp(originalBuffer).resize(640, undefined, resizeOpts).webp(webpOpts).toBuffer(),
    sharp(originalBuffer).resize(1280, undefined, resizeOpts).webp(webpOpts).toBuffer(),
    sharp(originalBuffer).resize(1920, undefined, resizeOpts).webp(webpOpts).toBuffer(),
    sharp(originalBuffer).resize(20).webp({ quality: 20 }).toBuffer(),
  ])

  return {
    variants: [
      { suffix: 'sm', buffer: sm, width: 640 },
      { suffix: 'md', buffer: md, width: 1280 },
      { suffix: 'lg', buffer: lg, width: 1920 },
    ],
    blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
  }
}
