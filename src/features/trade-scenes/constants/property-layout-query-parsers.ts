import type { PropertyLayout } from '@/features/trade-scenes/types'
import { createParser, throttle } from 'nuqs/server'

import { LAYOUT_TILE } from '@/features/trade-scenes/constants/layout-grid'
import { decodePropertyLayout, encodePropertyLayout } from '@/features/trade-scenes/lib/layout-codec'

// A heavily edited lot encodes to ~16 KB, too long for a link to carry reliably; above this the URL keeps the last layout that fit.
export const LAYOUT_URL_MAX = 8000

export const propertyLayoutParser = createParser<PropertyLayout>({
  parse: text => decodePropertyLayout(text, LAYOUT_TILE),
  serialize: encodePropertyLayout,
  eq: (a, b) => a === b,
}).withOptions({ history: 'replace', limitUrlUpdates: throttle(300) })
