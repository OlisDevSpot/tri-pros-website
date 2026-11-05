import { RESIDENT_F } from '@/features/trade-scenes/constants/home-temperatures'
import { thermalPaintColor } from '@/features/trade-scenes/ui/lib/thermal-paint-color'
import { normalizeOnScale } from '@/shared/components/scene/lib/normalize-on-scale'
import { THERMAL_SCALE_F } from '@/shared/modules/construction/core/constants/climate-presets'

// One object for every figure, so turning the camera on never hands a figure a new prop it would repaint for.
export const RESIDENT_THERMAL_PAINT = { color: `#${thermalPaintColor(normalizeOnScale(RESIDENT_F, THERMAL_SCALE_F)).getHexString()}` } as const
