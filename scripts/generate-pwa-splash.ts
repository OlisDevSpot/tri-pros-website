import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
/**
 * Generates iOS startup images (Apple "splash screens") for the installed PWA:
 * the TPR logo centered on a solid `#09090b` canvas, one PNG per Apple portrait
 * device at its exact pixel dimensions. iOS matches startup images by exact
 * device pixel size (via the `media` query on each
 * <link rel="apple-touch-startup-image">) and falls back to WHITE if none
 * match, so we need one PNG per device.
 *
 * This is the actual launch brand moment on iOS — a static logo, shown by the
 * OS before the web view paints. There is no in-app cover; the native startup
 * image is the entire launch brand, and the app fades in over it on hydration.
 *
 * NOTE: iOS caches these at "Add to Home Screen" time AND keys its cache on the
 * file URL — an unchanged filename can serve a stale image even after a
 * reinstall. Bump SPLASH_VERSION whenever the image content changes so the new
 * PNGs get fresh URLs iOS is forced to re-fetch. The metadata `startupImage`
 * URLs in src/app/(frontend)/layout.tsx must use the same version.
 *
 * Superseded `pwa-asset-generator`, which is broken in this environment.
 *
 * Run: npx tsx scripts/generate-pwa-splash.ts
 */
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'public/pwa/splash')
const LOGO_PATH = resolve(ROOT, 'public/company/logo/logo-dark.svg')
const BG_COLOR = '#09090b'
// iOS caches startup images by URL and won't re-fetch an unchanged filename,
// even across reinstalls. Bump this whenever the image content changes (logo,
// color) so the new PNGs land. Keep in sync with the URLs in layout.tsx.
const SPLASH_VERSION = 'v2'
// Logo width as a fraction of the device width — matches the .pwa-launch-logo
// sizing (45vw) so the native startup image and the web cover show the mark at
// the same size and position.
const LOGO_WIDTH_RATIO = 0.45

const logoSvg = readFileSync(LOGO_PATH)

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

// Clear stale splash PNGs before regenerating — otherwise removing a device
// from the matrix leaves an orphaned file that no longer matches metadata.
for (const existing of readdirSync(OUT_DIR)) {
  if (existing.startsWith('apple-splash-') && existing.endsWith('.png')) {
    rmSync(resolve(OUT_DIR, existing))
  }
}

for (const device of DEVICES) {
  const { cssW, cssH, dpr, pxW, pxH } = device

  if (pxW !== cssW * dpr || pxH !== cssH * dpr) {
    throw new Error(
      `Device matrix typo: ${cssW}x${cssH}@${dpr}x should be ${cssW * dpr}x${cssH * dpr}, got ${pxW}x${pxH}`,
    )
  }

  const filename = `apple-splash-${pxW}-${pxH}-${SPLASH_VERSION}.png`

  // Rasterize the logo to this device's target width, then center-composite it
  // onto the dark canvas.
  const logo = await sharp(logoSvg)
    .resize({ width: Math.round(pxW * LOGO_WIDTH_RATIO) })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: pxW,
      height: pxH,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT_DIR, filename))

  console.log(`Generated ${filename} (${pxW}x${pxH})`)
}

console.log(`Done. ${DEVICES.length} splash images written to public/pwa/splash/`)
