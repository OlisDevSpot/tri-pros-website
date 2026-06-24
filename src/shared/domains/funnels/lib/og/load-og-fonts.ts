import type { Buffer } from 'node:buffer'
import { readPublicBuffer } from '@/shared/domains/funnels/lib/og/og-assets'
import 'server-only'

export interface OgFont {
  name: string
  data: Buffer
  weight: 400 | 700
  style: 'normal'
}

/** Load brand fonts for the OG renderer from `public/fonts/` (read off disk). */
export async function loadOgFonts(): Promise<OgFont[]> {
  const serif = await readPublicBuffer('/fonts/PlayfairDisplay-Bold.ttf')
  return [{ name: 'Playfair Display', data: serif, weight: 700, style: 'normal' }]
}
