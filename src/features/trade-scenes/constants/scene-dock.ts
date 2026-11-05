import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'

const { width, padding, border, tile, divider } = SCENE_LAYOUT.dock
const TILE_WIDTH = width - 2 * (padding + border)

// Every control is sized by the numbers the strip's height is worked out from, never by what it holds, so a longer label
// or a fallback font can never stand the strip taller than its fold allows.
export const DOCK_SIZES = {
  tile: { width: TILE_WIDTH, height: tile },
  divider: { height: 1, marginBlock: (divider - 1) / 2 },
} as const

// Every dock control is one of these tiles, so the strip reads as one column whatever each one holds. A picked tile keeps
// its fill under the pointer: the compound variant outranks the plain hover.
export const DOCK_BUTTON_CLASS = 'group/dock relative grid place-content-center justify-items-center gap-1 rounded-[10px] px-1.5 py-px text-xs leading-4 font-bold text-muted-foreground outline-none hover:bg-hover hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-expanded:bg-control-selected aria-expanded:text-foreground aria-expanded:hover:bg-control-selected aria-pressed:bg-control-selected aria-pressed:text-foreground aria-pressed:hover:bg-control-selected'

// A weather thumbnail is the still drawn 2.2 times the tile's width, its point at 50% across and 45% down held at the
// same point of the tile: it closes in on the roof and the wall, where each weather's light shows.
export const DOCK_THUMB_CROP = 'absolute top-[45%] left-1/2 h-auto w-[220%] max-w-none -translate-x-1/2 -translate-y-[45%]'

// The size the still is drawn at in a tile (2.2 × 44 px wide, the stills' 1144 × 1640 shape), so it is fetched at that.
export const DOCK_THUMB_SIZE = { width: 97, height: 139 } as const

// The weather folds its four tiles to one button where the strip has no room for them.
export const DOCK_FOLDS = ['none', 'weather'] as const
