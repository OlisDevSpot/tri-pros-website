import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
/**
 * One-time script to generate PWA icons from the SVG logo.
 * Run: node scripts/generate-pwa-icons.mjs
 */
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const LOGO_SVG = resolve(ROOT, 'public/company/logo/logo-dark.svg')
const OUT_DIR = resolve(ROOT, 'public/pwa')
const BG_COLOR = '#09090b'

const SIZES = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

const svgBuffer = readFileSync(LOGO_SVG)

for (const { name, size } of SIZES) {
  const logoSize = Math.round(size * 0.6)
  const resizedLogo = await sharp(svgBuffer)
    .resize(logoSize, logoSize, { fit: 'inside' })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .composite([{ input: resizedLogo, gravity: 'centre' }])
    .png()
    .toFile(resolve(OUT_DIR, name))

  console.log(`Generated ${name} (${size}x${size})`)
}

console.log('Done.')
