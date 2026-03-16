import fs from 'node:fs'
import path from 'node:path'
import { DOWNLOAD_CONCURRENCY } from './constants'
import type { ScrapedImage } from './types'

function detectImageType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null

  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'jpg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'png'
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return 'webp'

  return null
}

async function downloadSingle(
  image: ScrapedImage,
  outputDir: string,
  index: number,
): Promise<string | null> {
  try {
    const response = await fetch(image.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      console.warn(`  [SKIP] HTTP ${response.status} for ${image.url}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Validate it's actually an image
    const detectedType = detectImageType(buffer)
    if (!detectedType) {
      console.warn(`  [SKIP] Not a valid image: ${image.url}`)
      return null
    }

    // Skip tiny files (< 5KB likely a thumbnail or placeholder)
    if (buffer.length < 5000) {
      console.warn(`  [SKIP] Too small (${buffer.length} bytes): ${image.url}`)
      return null
    }

    const paddedIndex = String(index).padStart(3, '0')
    const filename = `${paddedIndex}.${detectedType}`
    const filepath = path.join(outputDir, filename)

    fs.writeFileSync(filepath, buffer)
    return filename
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`  [SKIP] Download failed: ${message} — ${image.url}`)
    return null
  }
}

export async function downloadImages(
  images: ScrapedImage[],
  outputDir: string,
): Promise<string[]> {
  fs.mkdirSync(outputDir, { recursive: true })

  const downloaded: string[] = []
  let fileIndex = 1

  // Process in batches for concurrency control
  for (let i = 0; i < images.length; i += DOWNLOAD_CONCURRENCY) {
    const batch = images.slice(i, i + DOWNLOAD_CONCURRENCY)
    const batchStartIndex = fileIndex

    const results = await Promise.all(
      batch.map((image, batchIdx) =>
        downloadSingle(image, outputDir, batchStartIndex + batchIdx),
      ),
    )

    for (const filename of results) {
      if (filename) {
        downloaded.push(filename)
      }
    }

    fileIndex += batch.length

    if (i + DOWNLOAD_CONCURRENCY < images.length) {
      console.log(`  Downloaded ${downloaded.length} images so far...`)
    }
  }

  return downloaded
}
