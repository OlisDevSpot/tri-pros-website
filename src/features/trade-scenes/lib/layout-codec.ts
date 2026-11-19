import type { PropertyLayoutWire } from '@/features/trade-scenes/schemas/property-layout'
import type { FenceMap, GroundLayer, GroundMaterialId, PropertyLayout, TileRect, YardBase, YardId } from '@/features/trade-scenes/types'
import { FENCE_KIND_INDEX, FENCE_KINDS_BY_LAYER } from '@/features/trade-scenes/constants/fence-kinds'
import { DEFAULT_GROUND_WEAR, GROUND_MATERIAL_IDS, GROUND_MATERIAL_INDEX, GROUND_MATERIALS, GROUND_MATERIALS_BY_LAYER, GROUND_WEAR_INDEX, GROUND_WEAR_NONE } from '@/features/trade-scenes/constants/ground-materials'
import { YARD_IDS } from '@/features/trade-scenes/constants/yards'
import { fenceMapSizes } from '@/features/trade-scenes/lib/fence-cells'
import { groundMaterialAt } from '@/features/trade-scenes/lib/ground-material-at'
import { groundWearAt } from '@/features/trade-scenes/lib/ground-wear-at'
import { retilePropertyLayout } from '@/features/trade-scenes/lib/retile-property-layout'
import { yardMap } from '@/features/trade-scenes/lib/yards'
import { LAYOUT_MAX_TILES_PER_SIDE, propertyLayoutWireSchema } from '@/features/trade-scenes/schemas/property-layout'

function encodeRuns(map: Uint8Array): string {
  const runs: string[] = []
  let start = 0
  for (let i = 1; i <= map.length; i++) {
    if (i === map.length || map[i] !== map[start]) {
      runs.push(`${map[start]}*${i - start}`)
      start = i
    }
  }
  return runs.join(',')
}

function decodeRuns(text: string, total: number): Uint8Array | null {
  const out = new Uint8Array(total)
  let at = 0
  for (const run of text.split(',')) {
    const match = /^(\d+)\*(\d+)$/.exec(run)
    if (!match) {
      return null
    }
    const value = Number(match[1])
    const count = Number(match[2])
    if (count <= 0 || value > 255 || at + count > total) {
      return null
    }
    out.fill(value, at, at + count)
    at += count
  }
  return at === total ? out : null
}

// A kind a layer does not offer (chain link on the build map) would draw a fence no select can name.
function decodeFenceMap(wire: { across: string, along: string }, sizes: { across: number, along: number }, layer: GroundLayer): FenceMap | null {
  const across = decodeRuns(wire.across, sizes.across)
  const along = decodeRuns(wire.along, sizes.along)
  const allowed = new Set([0, ...FENCE_KINDS_BY_LAYER[layer].map(id => FENCE_KIND_INDEX[id])])
  if (!across || !along || across.some(v => !allowed.has(v)) || along.some(v => !allowed.has(v))) {
    return null
  }
  return { across, along }
}

const WEAR_LEVELS = GROUND_WEAR_INDEX.failing

// A pool is not a base: nothing is built on it, and a build-only material is not on the lot today.
function baseOf(material: number, wear: number, appearance: number): YardBase | null {
  const id = groundMaterialAt(material)
  if (!id || id === 'pool' || !GROUND_MATERIALS_BY_LAYER.existing.includes(id) || wear > WEAR_LEVELS) {
    return null
  }
  return { material: id, wear: GROUND_MATERIALS[id].wears ? groundWearAt(wear) : null, appearance }
}

function wearOfMaterial(value: number): number {
  const id = groundMaterialAt(value)
  return id && GROUND_MATERIALS[id].wears ? GROUND_WEAR_INDEX[DEFAULT_GROUND_WEAR] : GROUND_WEAR_NONE
}

// An old link carried neither: every wearing tile reads Good, and a yard's base is what most of it is made of.
function withDefaultWear(layout: PropertyLayout): PropertyLayout {
  const { lot } = layout
  const yards = yardMap(layout)
  const wear = lot.existing.map(wearOfMaterial)
  const bases = Object.fromEntries(YARD_IDS.map((yard, y) => {
    const counts = new Map<string, number>()
    lot.existing.forEach((value, i) => {
      const id = groundMaterialAt(value)
      if (yards[i] === y && id && id !== 'pool') {
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
    })
    let material: GroundMaterialId = 'sod'
    let most = 0
    for (const id of GROUND_MATERIAL_IDS) {
      if ((counts.get(id) ?? 0) > most) {
        material = id
        most = counts.get(id)!
      }
    }
    return [yard, { material, wear: GROUND_MATERIALS[material].wears ? DEFAULT_GROUND_WEAR : null, appearance: 0 }]
  })) as Record<YardId, YardBase>
  return { ...layout, lot: { ...lot, wear, bases } }
}

function overlaps(a: TileRect, b: TileRect) {
  return a.c0 < b.c0 + b.cols && b.c0 < a.c0 + a.cols && a.r0 < b.r0 + b.rows && b.r0 < a.r0 + a.rows
}

function massesAreValid(layout: PropertyLayout): boolean {
  const { masses } = layout.house
  const { cols, rows } = layout.lot
  return masses.filter(m => m.role === 'main').length === 1
    && masses.every(m => m.c0 + m.cols <= cols && m.r0 + m.rows <= rows)
    && !masses.some((a, i) => masses.slice(i + 1).some(b => overlaps(a, b)))
}

export function encodePropertyLayout(layout: PropertyLayout): string {
  const { lot, house } = layout
  const wire: PropertyLayoutWire = {
    _v: 4,
    t: layout.tile,
    lot: {
      c: lot.cols,
      r: lot.rows,
      existing: encodeRuns(lot.existing),
      proposed: encodeRuns(lot.proposed),
      wear: encodeRuns(lot.wear),
      appearance: { existing: encodeRuns(lot.appearance.existing), proposed: encodeRuns(lot.appearance.proposed) },
      bases: Object.fromEntries(YARD_IDS.map(yard => [yard, { m: GROUND_MATERIAL_INDEX[lot.bases[yard].material], w: lot.bases[yard].wear ? GROUND_WEAR_INDEX[lot.bases[yard].wear!] : GROUND_WEAR_NONE, a: lot.bases[yard].appearance }])) as Record<YardId, { m: number, w: number, a: number }>,
      fence: {
        existing: { across: encodeRuns(lot.fence.existing.across), along: encodeRuns(lot.fence.existing.along) },
        proposed: { across: encodeRuns(lot.fence.proposed.across), along: encodeRuns(lot.fence.proposed.along) },
      },
      grade: { padEndRow: lot.grade.padEndRow, walkDrop: lot.grade.walkDrop, streetDrop: lot.grade.streetDrop },
    },
    house: {
      masses: house.masses.map(m => ({ id: m.id, c0: m.c0, r0: m.r0, cols: m.cols, rows: m.rows, stories: m.stories, ...(m.ridgeAxis ? { ridgeAxis: m.ridgeAxis } : {}), role: m.role })),
      roof: house.roof,
      foundation: house.foundation,
      rooms: house.rooms.map(r => ({ massId: r.massId, kind: r.kind, span: { c0: r.span.c0, r0: r.span.r0, cols: r.span.cols, rows: r.span.rows }, story: r.story })),
    },
    source: layout.source,
    ...(layout.draft ? { draft: { address: layout.draft.address, imageryDate: layout.draft.imageryDate, sources: [...layout.draft.sources], confidence: layout.draft.confidence } } : {}),
  }
  return JSON.stringify(wire)
}

export function decodePropertyLayout(text: string, tile: number): PropertyLayout | null {
  try {
    const parsed = propertyLayoutWireSchema.safeParse(JSON.parse(text))
    if (!parsed.success) {
      return null
    }
    const { lot, house } = parsed.data
    const total = lot.c * lot.r
    const existing = decodeRuns(lot.existing, total)
    const proposed = decodeRuns(lot.proposed, total)
    if (!existing || !proposed) {
      return null
    }
    const limit = GROUND_MATERIAL_IDS.length + 1
    if (existing.some(v => v >= limit) || proposed.some(v => v >= limit)) {
      return null
    }
    const wear = parsed.data._v >= 3 ? decodeRuns(lot.wear ?? '', total) : new Uint8Array(total)
    if (!wear || wear.some(v => v > WEAR_LEVELS)) {
      return null
    }
    // A byte past a material's list is no reject: the list may have shrunk since the link was made, and it draws as the first look.
    const appearanceExisting = lot.appearance ? decodeRuns(lot.appearance.existing, total) : new Uint8Array(total)
    const appearanceProposed = lot.appearance ? decodeRuns(lot.appearance.proposed, total) : new Uint8Array(total)
    if (!appearanceExisting || !appearanceProposed) {
      return null
    }
    const bases = {} as Record<YardId, YardBase>
    for (const yard of YARD_IDS) {
      const wire = lot.bases?.[yard]
      const base = parsed.data._v === 2 ? { material: 'sod' as const, wear: null, appearance: 0 } : wire && baseOf(wire.m, wire.w, wire.a ?? 0)
      if (!base) {
        return null
      }
      bases[yard] = base
    }
    const fenceSizes = fenceMapSizes({ cols: lot.c, rows: lot.r })
    const existingFence = decodeFenceMap(lot.fence.existing, fenceSizes, 'existing')
    const proposedFence = decodeFenceMap(lot.fence.proposed, fenceSizes, 'proposed')
    if (!existingFence || !proposedFence) {
      return null
    }
    const layout: PropertyLayout = {
      version: 1,
      tile: parsed.data.t,
      lot: { cols: lot.c, rows: lot.r, existing, proposed, wear, appearance: { existing: appearanceExisting, proposed: appearanceProposed }, bases, fence: { existing: existingFence, proposed: proposedFence }, grade: lot.grade },
      house,
      source: parsed.data.source,
      ...(parsed.data.draft ? { draft: parsed.data.draft } : {}),
    }
    if (!massesAreValid(layout)) {
      return null
    }
    const filled = parsed.data._v >= 3 ? layout : withDefaultWear(layout)
    // The wire cap bounds the grid as sent; a coarse wire tile re-tiled to a fine one multiplies it, so check the grid that will be built.
    const scale = layout.tile / tile
    if (Math.max(1, Math.round(lot.c * scale)) > LAYOUT_MAX_TILES_PER_SIDE || Math.max(1, Math.round(lot.r * scale)) > LAYOUT_MAX_TILES_PER_SIDE) {
      return null
    }
    const retiled = retilePropertyLayout(filled, tile)
    return massesAreValid(retiled) ? retiled : null
  }
  catch {
    return null
  }
}
