import { loadFont as loadNunito } from '@remotion/google-fonts/Nunito'
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay'

const playfair = loadPlayfair('normal', { weights: ['700', '800'] })
const nunito = loadNunito('normal', { weights: ['600', '700', '800'] })

export const DISPLAY_FONT = playfair.fontFamily
export const BODY_FONT = nunito.fontFamily
