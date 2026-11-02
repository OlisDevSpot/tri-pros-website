import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { HOME_SCENE_DEFAULTS } from '@/features/trade-scenes/constants/home-scene-defaults'
import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { BLUEPRINT_LINE_CLASS, BLUEPRINT_OMIT_TAG, SCENE_LOAD } from '@/features/trade-scenes/constants/scene-load'
import { LIGHTFORMER_RESOLUTION, SKY_IMAGE } from '@/features/trade-scenes/constants/weather-skies'
import { isBlueprintOmitted } from '@/features/trade-scenes/lib/blueprint-tag'
import { advanceSceneLoad, createSceneLoad, finishDrawIn, markSceneReady } from '@/features/trade-scenes/lib/create-scene-load'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'

const store = createSceneLoad()
advanceSceneLoad(store, 'drawing')
advanceSceneLoad(store, 'paper')
assert.equal(store.getState().phase, 'drawing', 'the phase never goes backwards')

markSceneReady(store)
assert.equal(store.getState().phase, 'drawing', 'a scene ready mid-draw still waits for the drawing to finish')
finishDrawIn(store)
assert.equal(store.getState().phase, 'handover', 'the drawing ending on a ready scene hands over')

const slow = createSceneLoad()
advanceSceneLoad(slow, 'drawing')
finishDrawIn(slow)
assert.equal(slow.getState().phase, 'waiting', 'the drawing ending before the scene is ready waits')
markSceneReady(slow)
assert.equal(slow.getState().phase, 'handover', 'the scene turning ready while waiting hands over')

const lost = createSceneLoad()
advanceSceneLoad(lost, 'live')
assert.equal(lost.getState().phase, 'live', 'a fallback or the watchdog can end the sequence from the paper')

assert.ok(isBlueprintOmitted({ ...thermalTag('exterior'), ...BLUEPRINT_OMIT_TAG }), 'a merged tag is omitted')
assert.equal({ ...thermalTag('exterior'), ...BLUEPRINT_OMIT_TAG }.thermalZone, 'exterior', 'merging keeps the thermal zone')
assert.ok(!isBlueprintOmitted(thermalTag('exterior')), 'untagged means drawn')
assert.ok(Object.isFrozen(BLUEPRINT_OMIT_TAG), 'the tag is shared, so it is frozen')

const header = readFileSync(join('public', SKY_IMAGE)).subarray(0, 200).toString('latin1')
const size = /-Y (\d+) \+X (\d+)/.exec(header)
assert.ok(size, 'the sky image header carries its resolution')
assert.equal(2 ** Math.floor(Math.log2(Number(size[2]) / 4)), LIGHTFORMER_RESOLUTION, 'the Lightformer cube matches the sky image\'s PMREM size')

assert.notEqual(HOME_SCENE_DEFAULTS.weather, 'rain', 'the scene mounts dry')
assert.equal(HOME_SCENE_DEFAULTS.thermalCamera, false, 'the scene mounts without the thermal camera')
assert.equal(HOME_SCENE_DEFAULTS.zoom, null, 'the scene mounts with no system kit')
assert.equal(HOME_SCENE_DEFAULTS.climate, null, 'coastal or inland is missing until set')

// The caps run from SceneReadySignal's mount and the watchdog from HomeSceneCanvas's, and the gate's frame and one rAF are left
// out, so this is a same-clock lower bound, not proof the watchdog never cuts a slow handover.
assert.ok(SCENE_LOAD.watchdogMs > SCENE_LOAD.overallCapMs + SCENE_LOAD.drawMs + SCENE_LOAD.linesDelayMs + SCENE_LOAD.linesFadeMs, 'the watchdog comes after every cap')
assert.ok(BLUEPRINT_LINE_CLASS.includes(`${SCENE_LAYOUT.portraitBelowWidth}px`), 'the loading line\'s portrait condition is stageShapeOf\'s')
assert.ok(BLUEPRINT_LINE_CLASS.includes(`${SCENE_LAYOUT.portraitBelowWidth}px)_and_(width<${SCENE_LAYOUT.narrowBelowWidth}px`), 'the loading line\'s narrow condition is stageShapeOf\'s')

console.log('ok')
