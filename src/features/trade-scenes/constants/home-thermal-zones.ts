// What the thermal camera reads each surface of the home as. A surface takes the zone of its nearest tagged group; a mesh
// with no tagged group above it is not the home's (the arrows, the anchors, the flows up close) and is left alone.
export const HOME_THERMAL_ZONES = ['roof', 'attic', 'ceiling', 'interior', 'exterior', 'sunlit', 'window', 'condenser', 'heating', 'cooling', 'resident', 'sky', 'leak', 'crawl', 'crawl-floor'] as const
export type HomeThermalZone = typeof HOME_THERMAL_ZONES[number]

// Every temperature the paint holds: the zones, plus any part the rain walk soaked, whatever zone it sits in.
export const HOME_PAINT_KEYS = [...HOME_THERMAL_ZONES, 'soaked'] as const
export type HomePaintKey = typeof HOME_PAINT_KEYS[number]

// A subtree that paints itself under the thermal camera (a figure) or must keep its own see-through look (a heat haze,
// falling rain).
export const OWN_PAINT = 'own'
