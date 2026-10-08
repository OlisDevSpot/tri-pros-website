/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { PWA_STARTUP_IMAGE_SIZES, PWA_STARTUP_IMAGES } from '@/shared/domains/pwa/constants/startup-images'

const MEDIA = /^screen and \(device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: (portrait|landscape)\)$/

assert.equal(PWA_STARTUP_IMAGES.length, PWA_STARTUP_IMAGE_SIZES.length * 2, 'both orientations for every size')

for (const { url, media } of PWA_STARTUP_IMAGES) {
  const match = MEDIA.exec(media)
  assert.ok(match, `media shape: ${media}`)
  const [, width, height, scale, orientation] = match
  const portrait = orientation === 'portrait'
  const expectWidth = (portrait ? Number(width) : Number(height)) * Number(scale)
  const expectHeight = (portrait ? Number(height) : Number(width)) * Number(scale)
  const meta = await sharp(resolve('public', url.slice(1))).metadata()
  assert.equal(meta.width, expectWidth, `${url} width`)
  assert.equal(meta.height, expectHeight, `${url} height`)
}

console.log(`✅ ${PWA_STARTUP_IMAGES.length} startup images match their media queries`)
