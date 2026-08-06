import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
/**
 * Generates plain dark iOS startup images (Apple "splash screens") to kill the
 * white native launch surface on cold PWA launch. Each PNG is a solid
 * `#09090b` rectangle at one Apple portrait device's exact pixel dimensions —
 * no logo, no compositing. iOS matches startup images by exact device pixel
 * size (via the `media` query on each <link rel="apple-touch-startup-image">
 * entry) and falls back to white if none match, so we need one PNG per device.
 *
 * The app's real SVG splash animation (PwaSplashScreen) takes over once React
 * hydrates — these images only need to bridge the gap before that.
 *
 * Superseded `pwa-asset-generator`, which is broken in this environment.
 *
 * Run: npx tsx scripts/generate-pwa-splash.ts
 */
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'public/pwa/splash')
const BG_COLOR = '#09090b'

// Apple portrait device matrix: css width/height @ device pixel ratio.
// pxW/pxH are declared explicitly (not derived) so a typo is caught by the
// assertion below rather than silently baked into a wrong-sized PNG.
const DEVICES = [
  { cssW: 320, cssH: 568, dpr: 2, pxW: 640, pxH: 1136 },
  { cssW: 375, cssH: 667, dpr: 2, pxW: 750, pxH: 1334 },
  { cssW: 414, cssH: 736, dpr: 3, pxW: 1242, pxH: 2208 },
  { cssW: 375, cssH: 812, dpr: 3, pxW: 1125, pxH: 2436 },
  { cssW: 414, cssH: 896, dpr: 2, pxW: 828, pxH: 1792 },
  { cssW: 414, cssH: 896, dpr: 3, pxW: 1242, pxH: 2688 },
  { cssW: 390, cssH: 844, dpr: 3, pxW: 1170, pxH: 2532 },
  { cssW: 428, cssH: 926, dpr: 3, pxW: 1284, pxH: 2778 },
  { cssW: 393, cssH: 852, dpr: 3, pxW: 1179, pxH: 2556 },
  { cssW: 430, cssH: 932, dpr: 3, pxW: 1290, pxH: 2796 },
  { cssW: 402, cssH: 874, dpr: 3, pxW: 1206, pxH: 2622 },
  { cssW: 440, cssH: 956, dpr: 3, pxW: 1320, pxH: 2868 },
  { cssW: 768, cssH: 1024, dpr: 2, pxW: 1536, pxH: 2048 },
  { cssW: 810, cssH: 1080, dpr: 2, pxW: 1620, pxH: 2160 },
  { cssW: 820, cssH: 1180, dpr: 2, pxW: 1640, pxH: 2360 },
  { cssW: 834, cssH: 1112, dpr: 2, pxW: 1668, pxH: 2224 },
  { cssW: 834, cssH: 1194, dpr: 2, pxW: 1668, pxH: 2388 },
  { cssW: 1024, cssH: 1366, dpr: 2, pxW: 2048, pxH: 2732 },
] as const

mkdirSync(OUT_DIR, { recursive: true })

for (const device of DEVICES) {
  const { cssW, cssH, dpr, pxW, pxH } = device

  if (pxW !== cssW * dpr || pxH !== cssH * dpr) {
    throw new Error(
      `Device matrix typo: ${cssW}x${cssH}@${dpr}x should be ${cssW * dpr}x${cssH * dpr}, got ${pxW}x${pxH}`,
    )
  }

  const filename = `apple-splash-${pxW}-${pxH}.png`

  await sharp({
    create: {
      width: pxW,
      height: pxH,
      channels: 3,
      background: BG_COLOR,
    },
  })
    // Solid single-color image: an indexed palette compresses to a few
    // hundred bytes vs. tens of KB for a naive truecolor PNG.
    .png({ compressionLevel: 9, palette: true, colors: 2 })
    .toFile(resolve(OUT_DIR, filename))

  console.log(`Generated ${filename} (${pxW}x${pxH})`)
}

console.log(`Done. ${DEVICES.length} splash images written to public/pwa/splash/`)
