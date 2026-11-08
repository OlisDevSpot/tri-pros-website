import type { CoolLifeColor, PaintCombo } from '@/shared/modules/construction/core/types'

// Heat-reflective colours from Cool Life's own palette
// (coollifepalette.lifetimepluscoatings.com/tenants/lifecoatings/colors.json). A subset: Cool Life matches any paint it is
// given. Hex values are Cool Life's screen values, so approximations only.
export const COOL_LIFE_FAMILIES = [
  { id: 'whites', name: 'Whites' },
  { id: 'neutrals', name: 'Neutrals' },
  { id: 'earth-tones', name: 'Earth Tones' },
  { id: 'blue-green-gray', name: 'Blue Green Gray' },
  { id: 'peaches-pinks-yellows', name: 'Peaches Pinks Yellows' },
] as const
export const COOL_LIFE_COLORS = [
  { id: 'sugar-dust', name: 'Sugar Dust', code: '0011', hex: '#f6f4ea', family: 'whites' },
  { id: 'cotton-ball', name: 'Cotton Ball', code: '0007', hex: '#f4eedf', family: 'whites' },
  { id: 'casa-blanca', name: 'Casa Blanca', code: '0008', hex: '#f3ecd9', family: 'whites' },
  { id: 'elusive-white', name: 'Elusive White', code: '0002', hex: '#e9e5d8', family: 'whites' },
  { id: 'moon-drop', name: 'Moon Drop', code: '0026', hex: '#dbd4c8', family: 'whites' },
  { id: 'private-white', name: 'Private White', code: '0292', hex: '#f2ead7', family: 'neutrals' },
  { id: 'maple-pecan', name: 'Maple Pecan', code: '0174', hex: '#e1d1bc', family: 'neutrals' },
  { id: 'ivory-ridge', name: 'Ivory Ridge', code: '0182', hex: '#d8cab8', family: 'neutrals' },
  { id: 'mulled-cider', name: 'Mulled Cider', code: '0244', hex: '#e3c59e', family: 'neutrals' },
  { id: 'candle-light', name: 'Candle Light', code: '0168', hex: '#dbc1a7', family: 'neutrals' },
  { id: 'soft-leather', name: 'Soft Leather', code: '0336', hex: '#c5bba9', family: 'neutrals' },
  { id: 'caramel-cloud', name: 'Caramel Cloud', code: '0245', hex: '#d3b188', family: 'neutrals' },
  { id: 'season-finale', name: 'Season Finale', code: '0267', hex: '#bfa57f', family: 'neutrals' },
  { id: 'tailored-tan', name: 'Tailored Tan', code: '0239', hex: '#bea182', family: 'neutrals' },
  { id: 'pavilion-tan', name: 'Pavilion Tan', code: '0149', hex: '#b39383', family: 'neutrals' },
  { id: 'moonscape', name: 'Moonscape', code: '0227', hex: '#8e826e', family: 'neutrals' },
  { id: 'golden-summer', name: 'Golden Summer', code: '0305', hex: '#846f4b', family: 'neutrals' },
  { id: 'brown-suede', name: 'Brown Suede', code: '0221', hex: '#62584c', family: 'neutrals' },
  { id: 'film-noir', name: 'Film Noir', code: '0144', hex: '#524641', family: 'neutrals' },
  { id: 'cheddar-corn', name: 'Cheddar Corn', code: '1001', hex: '#f3d3b5', family: 'earth-tones' },
  { id: 'goby-desert', name: 'Goby Desert', code: '0898', hex: '#d3ac73', family: 'earth-tones' },
  { id: 'orestes', name: 'Orestes', code: '0379', hex: '#a29e87', family: 'earth-tones' },
  { id: 'orange-ballad', name: 'Orange Ballad', code: '1019', hex: '#b57248', family: 'earth-tones' },
  { id: 'april-love', name: 'April Love', code: '1061', hex: '#8e4b3f', family: 'earth-tones' },
  { id: 'felicity', name: 'Felicity', code: '0523', hex: '#e5e4df', family: 'blue-green-gray' },
  { id: 'raindance', name: 'Raindance', code: '0474', hex: '#d6ddd5', family: 'blue-green-gray' },
  { id: 'snowglory', name: 'Snowglory', code: '0531', hex: '#c9c8c4', family: 'blue-green-gray' },
  { id: 'water-droplet', name: 'Water Droplet', code: '0503', hex: '#bec9ce', family: 'blue-green-gray' },
  { id: 'hearthstone', name: 'Hearthstone', code: '0567', hex: '#c6beb2', family: 'blue-green-gray' },
  { id: 'in-the-blue', name: 'In the Blue', code: '0504', hex: '#a0b2bc', family: 'blue-green-gray' },
  { id: 'smoky-tone', name: 'Smoky Tone', code: '0541', hex: '#a0a09f', family: 'blue-green-gray' },
  { id: 'overcast-day', name: 'Overcast Day', code: '0512', hex: '#939ba4', family: 'blue-green-gray' },
  { id: 'everlasting-sage', name: 'Everlasting Sage', code: '0422', hex: '#97998b', family: 'blue-green-gray' },
  { id: 'greystoke', name: 'Greystoke', code: '0575', hex: '#8b8981', family: 'blue-green-gray' },
  { id: 'deep-lagoon', name: 'Deep Lagoon', code: '0507', hex: '#67737c', family: 'blue-green-gray' },
  { id: 'gargoyle', name: 'Gargoyle', code: '0550', hex: '#655a56', family: 'blue-green-gray' },
  { id: 'queen-of-the-night', name: 'Queen of the Night', code: '0655', hex: '#395e7a', family: 'blue-green-gray' },
  { id: 'deep-space', name: 'Deep Space', code: '0487', hex: '#4f5d5d', family: 'blue-green-gray' },
  { id: 'black-licorice', name: 'Black Licorice', code: '0529', hex: '#474848', family: 'blue-green-gray' },
  { id: 'silent-sea', name: 'Silent Sea', code: '0515', hex: '#3e3f40', family: 'blue-green-gray' },
  { id: 'strawberry-whip', name: 'Strawberry Whip', code: '0055', hex: '#f7d7cd', family: 'peaches-pinks-yellows' },
  { id: 'starlet', name: 'Starlet', code: '0094', hex: '#88585a', family: 'peaches-pinks-yellows' },
] as const satisfies readonly CoolLifeColor[]
// The short row each part shows first; every combo's colours are in it.
export const COOL_LIFE_QUICK_COLOR_IDS = ['sugar-dust', 'cotton-ball', 'maple-pecan', 'hearthstone', 'tailored-tan', 'greystoke', 'in-the-blue', 'deep-space', 'brown-suede', 'black-licorice'] as const satisfies readonly CoolLifeColorId[]
export const PAINT_COMBOS = [
  { id: 'light-dark', name: 'Light & dark', body: 'cotton-ball', trim: 'black-licorice' },
  { id: 'tan-dark', name: 'Tan & dark', body: 'tailored-tan', trim: 'brown-suede' },
  { id: 'dark-light', name: 'Dark & light', body: 'deep-space', trim: 'sugar-dust' },
  { id: 'colourful', name: 'Colourful', body: 'in-the-blue', trim: 'sugar-dust' },
] as const satisfies readonly PaintCombo[]
export const COOL_LIFE_FAN_DECK_URL = 'https://coollifepalette.lifetimepluscoatings.com/#/colors'

export type CoolLifeFamilyId = (typeof COOL_LIFE_FAMILIES)[number]['id']
export type CoolLifeColorId = (typeof COOL_LIFE_COLORS)[number]['id']
export type PaintComboId = (typeof PAINT_COMBOS)[number]['id']
