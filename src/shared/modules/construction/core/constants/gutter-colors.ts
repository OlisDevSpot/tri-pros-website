// Screen approximations of the usual aluminum gutter colours, with no supplier chart yet. A working number, set by shot.
export const GUTTER_COLORS = [
  { id: 'white', name: 'White', hex: '#f2f1ec' },
  { id: 'almond', name: 'Almond', hex: '#ece4d4' },
  { id: 'clay', name: 'Clay', hex: '#b5a68c' },
  { id: 'musket-brown', name: 'Musket Brown', hex: '#6e5d48' },
  { id: 'royal-brown', name: 'Royal Brown', hex: '#4b3527' },
  { id: 'dark-bronze', name: 'Dark Bronze', hex: '#3b332b' },
  { id: 'black', name: 'Black', hex: '#262728' },
] as const

export type GutterColorId = (typeof GUTTER_COLORS)[number]['id']
