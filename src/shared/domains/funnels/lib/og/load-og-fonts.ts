import 'server-only'

export interface OgFont {
  name: string
  data: ArrayBuffer
  weight: 400 | 700
  style: 'normal'
}

/** Load brand fonts for the OG renderer from a committed TTF (traced via import.meta.url). */
export async function loadOgFonts(): Promise<OgFont[]> {
  const serif = await fetch(
    new URL('./fonts/PlayfairDisplay-Bold.ttf', import.meta.url),
  ).then(r => r.arrayBuffer())
  return [{ name: 'Playfair Display', data: serif, weight: 700, style: 'normal' }]
}
