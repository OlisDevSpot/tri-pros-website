import { loadFont as loadCormorant } from '@remotion/google-fonts/CormorantGaramond'
import { loadFont as loadFraunces } from '@remotion/google-fonts/Fraunces'
import { loadFont as loadNunito } from '@remotion/google-fonts/Nunito'
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay'

const playfair = loadPlayfair('normal', { weights: ['700', '800'] })
const playfairItalic = loadPlayfair('italic', { weights: ['700'] })
const fraunces = loadFraunces('italic', { weights: ['700'] })
const cormorant = loadCormorant('italic', { weights: ['700'] })
const nunito = loadNunito('normal', { weights: ['600', '700', '800'] })

export const DISPLAY_FONT = playfair.fontFamily
export const BODY_FONT = nunito.fontFamily
/** Luxe serif for emphasized caption words — Oliver picks from rendered samples, then freeze. */
export const EMPHASIS_FONT_CANDIDATES = {
  playfair: playfairItalic.fontFamily,
  fraunces: fraunces.fontFamily,
  cormorant: cormorant.fontFamily,
} as const
export const EMPHASIS_FONT = EMPHASIS_FONT_CANDIDATES.playfair
