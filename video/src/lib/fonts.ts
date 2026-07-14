import { loadFont as loadNunito } from '@remotion/google-fonts/Nunito'
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay'

const playfair = loadPlayfair('normal', { weights: ['700', '800'] })
const playfairItalic = loadPlayfair('italic', { weights: ['700'] })
const nunito = loadNunito('normal', { weights: ['600', '700', '800'] })

export const DISPLAY_FONT = playfair.fontFamily
export const BODY_FONT = nunito.fontFamily
/**
 * Luxe serif for emphasized caption words (`*word*` markup) — FROZEN house
 * style: Playfair Display italic, picked by Oliver 2026-07-14 from rendered
 * samples (vs Fraunces italic, Cormorant Garamond italic).
 */
export const EMPHASIS_FONT = playfairItalic.fontFamily
