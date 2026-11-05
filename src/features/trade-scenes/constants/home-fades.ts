import type { HomeFade, HomeFadeLevels } from '@/features/trade-scenes/types'

// Each names the state its parts show in: a home view, or a foundation. The order is also the thermal paint's fade bits.
export const HOME_FADES = ['complete', 'raised', 'slab'] as const

export const HOME_FADES_SHOWN: HomeFadeLevels = { complete: 1, raised: 1, slab: 1 }

// Mid-fade, the Complete house's cut-away parts fade as one sheet: only their surface nearest the camera blends, so a fading
// wall never shows the jambs inside it, nor a fading slope its deck and rafters. The foundations cross-fade into each other
// instead, which a sheet would hide.
export const SHEET_FADES: ReadonlySet<HomeFade> = new Set<HomeFade>(['complete'])

// After the rest of the house and every see-through part, before the heat arrows (`HEAT_ARROW_LOOK.renderOrder`).
export const FADE_SHEET_ORDER = { depth: 4, color: 5 } as const

const tagFor = (homeFade: HomeFade): Readonly<{ homeFade: HomeFade }> => Object.freeze({ homeFade })

// The `userData` of a group whose parts fade together (a group, never a mesh: the ghost writes to a mesh's own userData).
// One frozen object per fade, so a re-render hands R3F the same object and it never rewrites the group's userData.
export const HOME_FADE_TAGS: Readonly<Record<HomeFade, Readonly<{ homeFade: HomeFade }>>> = Object.freeze({
  complete: tagFor('complete'),
  raised: tagFor('raised'),
  slab: tagFor('slab'),
})

// The `userData` of a root the home's ghost fades (the house, and what stands on the ground beside it). The thermal paint
// keeps what lies under one apart from the same zone's paint elsewhere, so the ghost never dims the yard with the house.
export const HOME_GHOST_TAG: Readonly<{ homeGhost: true }> = Object.freeze({ homeGhost: true })
