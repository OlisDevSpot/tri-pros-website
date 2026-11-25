import type { LayoutSource, Mass, MassRole, RoofShape, RoomStandIn } from '@/features/trade-scenes/types'
import { z } from 'zod'
import { YARD_IDS } from '@/features/trade-scenes/constants/yards'
import { foundationTypes } from '@/shared/modules/construction/core/constants/enums'

const roofShapes = ['gable', 'hip', 'flat'] as const satisfies readonly RoofShape[]
const massRoles = ['main', 'wing', 'garage'] as const satisfies readonly MassRole[]
const layoutSources = ['default', 'drafted', 'edited'] as const satisfies readonly LayoutSource[]
const roomKinds = ['living', 'kitchen', 'bed', 'bath'] as const satisfies readonly RoomStandIn['kind'][]
const ridgeAxes = ['x', 'z'] as const satisfies readonly NonNullable<Mass['ridgeAxis']>[]
const storyCounts = [1, 2] as const satisfies readonly Mass['stories'][]

// Far above any re-tiled lot; stops a crafted size from allocating gigabytes before the runs are checked.
export const LAYOUT_MAX_TILES_PER_SIDE = 512

// No real survey uses a tile outside this range; bounding it keeps zero, negative and absurd tiles out of the re-tile arithmetic.
export const LAYOUT_MIN_WIRE_TILE = 0.05
export const LAYOUT_MAX_WIRE_TILE = 10

// tsc fails here when a union gains a member the wire list lacks.
type Covers<Union, Listed> = [Union] extends [Listed] ? true : never
const _enumsCoverTheTypes: [
  Covers<RoofShape, typeof roofShapes[number]>,
  Covers<MassRole, typeof massRoles[number]>,
  Covers<LayoutSource, typeof layoutSources[number]>,
  Covers<RoomStandIn['kind'], typeof roomKinds[number]>,
  Covers<NonNullable<Mass['ridgeAxis']>, typeof ridgeAxes[number]>,
  Covers<Mass['stories'], typeof storyCounts[number]>,
] = [true, true, true, true, true, true]
void _enumsCoverTheTypes

const index = z.number().int().nonnegative()
const count = z.number().int().positive()
const tileRect = z.object({ c0: index, r0: index, cols: count, rows: count })
const stories = z.union([z.literal(storyCounts[0]), z.literal(storyCounts[1])])

const massSchema = tileRect.extend({
  id: z.string().min(1),
  stories,
  ridgeAxis: z.enum(ridgeAxes).optional(),
  role: z.enum(massRoles),
})

const roomSchema = z.object({
  massId: z.string().min(1),
  kind: z.enum(roomKinds),
  span: tileRect,
  story: stories,
})

const fenceMapSchema = z.object({ across: z.string(), along: z.string() })

const draftSchema = z.object({
  address: z.string(),
  imageryDate: z.string().nullable(),
  sources: z.array(z.string()),
  confidence: z.number(),
})

export const propertyLayoutWireSchema = z.object({
  _v: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  t: z.number().min(LAYOUT_MIN_WIRE_TILE).max(LAYOUT_MAX_WIRE_TILE),
  lot: z.object({
    c: count.max(LAYOUT_MAX_TILES_PER_SIDE),
    r: count.max(LAYOUT_MAX_TILES_PER_SIDE),
    existing: z.string(),
    proposed: z.string(),
    wear: z.string().optional(),
    appearance: z.object({ existing: z.string(), proposed: z.string() }).optional(),
    bases: z.record(z.enum(YARD_IDS), z.object({ m: index, w: index, a: index.max(255).optional() })).optional(),
    fence: z.object({ existing: fenceMapSchema, proposed: fenceMapSchema }),
    grade: z.object({ padEndRow: index, walkDrop: z.number(), streetDrop: z.number() }),
  }),
  house: z.object({
    masses: z.array(massSchema),
    roof: z.enum(roofShapes),
    foundation: z.enum(foundationTypes),
    rooms: z.array(roomSchema),
  }),
  source: z.enum(layoutSources),
  draft: draftSchema.optional(),
})

export type PropertyLayoutWire = z.infer<typeof propertyLayoutWireSchema>
