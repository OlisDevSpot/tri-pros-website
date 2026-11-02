import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'
import type { RoofType } from '@/shared/modules/construction/core/constants/enums'
import type { Weather } from '@/shared/modules/construction/core/types'

export const HOME_VIEWS = ['complete', 'partly-open'] as const

// Leaving a close-up for the whole home: the next zoom opens closed and unemphasised, wherever this one was left.
export const LEAVE_CLOSE_UP = { zoom: null, peel: 0, emphasizedPart: null } as const satisfies Partial<TradeSceneInputs>

export const SCENE_WEATHERS = ['normal', 'summer', 'winter', 'rain'] as const satisfies readonly Weather[]

// Until the agent zooms into another assembly, the home offers the roof's work: the roof is the story the scene opens on.
export const HOME_PRIMARY_ASSEMBLY: AssemblyId = 'roof-attic'

// Radix toggle groups carry strings, so a profile field that is not on record travels as this value.
export const UNKNOWN_CHOICE = 'unknown'

// The same for a build row left at No change: a value no scope id can take.
export const NO_CHANGE_CHOICE = 'no-change'

// The peel slider's resolution: fine enough that a slow drag reads as continuous.
export const PEEL_SLIDER_STEPS = 100

// The order a rep scans them in: the common roofs first, metal last because it draws as the nearest covering.
export const PROFILE_ROOF_TYPES = ['shingle', 'tile', 'woodshake', 'flat', 'metal'] as const satisfies readonly RoofType[]
