/* eslint-disable no-console */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { PWA_LAUNCH_FIELD } from '@/shared/domains/pwa/constants/launch'

// Run: pnpm exec tsx scripts/generate-pwa-icons.ts
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const LOGO_SVG = resolve(ROOT, 'public/company/logo/logo-dark.svg')
const OUT_DIR = resolve(ROOT, 'public/pwa')

// Android draws the maskable icon through a circle whose radius is 40% of the icon; the mark at half the
// width keeps its corners inside that circle. The others keep the mark at 60%, as before.
const ICONS = [
  { name: 'icon-192.png', size: 192, markRatio: 0.6 },
  { name: 'icon-512.png', size: 512, markRatio: 0.6 },
  { name: 'icon-maskable-512.png', size: 512, markRatio: 0.5 },
  { name: 'apple-touch-icon.png', size: 180, markRatio: 0.6 },
]

const svg = readFileSync(LOGO_SVG)

for (const { name, size, markRatio } of ICONS) {
  const mark = await sharp(svg).resize({ width: Math.round(size * markRatio) }).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: PWA_LAUNCH_FIELD } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toFile(resolve(OUT_DIR, name))
  console.log(`Generated ${name} (${size}x${size})`)
}
