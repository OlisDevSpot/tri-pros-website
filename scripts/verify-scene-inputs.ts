import assert from 'node:assert/strict'

import { SCENE_BURST } from '@/shared/components/scene/constants/scene-burst'
import { burstProgress } from '@/shared/components/scene/lib/burst-progress'
import { createSceneInputs } from '@/shared/components/scene/lib/create-scene-inputs'
import { normalizeOnScale } from '@/shared/components/scene/lib/normalize-on-scale'
import { widenFovForAspect } from '@/shared/components/scene/lib/widen-fov-for-aspect'

const first = createSceneInputs({ a: 1 })
const second = createSceneInputs({ a: 1 })
first.setState({ a: 2 })
assert.equal(first.getState().a, 2, 'setState is readable through getState')
assert.equal(second.getState().a, 1, 'two open scenes do not share inputs')

assert.equal(SCENE_BURST.seconds, 120)

assert.equal(burstProgress(3, 3), 0, 'burst starts at 0')
assert.equal(burstProgress(3, 63), 0.5, 'half-way at 1 minute')
assert.equal(burstProgress(3, 123), 1, 'done at 2 minutes')
assert.equal(burstProgress(3, 500), 1, 'clamped at 1')
assert.equal(burstProgress(3, 1), 0, 'clamped at 0')

assert.equal(normalizeOnScale(20, { min: 20, max: 180 }), 0, 'scale min is 0')
assert.equal(normalizeOnScale(180, { min: 20, max: 180 }), 1, 'scale max is 1')
assert.equal(normalizeOnScale(200, { min: 20, max: 180 }), 1, 'above the scale clamps to 1')

assert.equal(widenFovForAspect(30, 16 / 9), 30, 'landscape keeps the fov')
assert.equal(widenFovForAspect(30, 4 / 3), 30, '4:3 keeps the fov')
const portrait = widenFovForAspect(30, 0.75)
assert.ok(portrait > 30 && portrait <= 100, 'portrait widens, within the cap')
assert.equal(widenFovForAspect(30, 0.01), 100, 'a sliver clamps at 100')

console.log('verify-scene-inputs: ok')
