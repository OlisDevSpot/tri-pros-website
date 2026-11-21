import type { BufferGeometry, WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three'
import type { StoreTimers, TextureRequest } from '@/features/trade-scenes/ui/lib/texture-store'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShaderLib, ShaderMaterial, Texture, UniformsUtils } from 'three'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'

import { GROUND_MATERIAL_INDEX, GROUND_MATERIALS, GROUND_WEAR_INDEX } from '@/features/trade-scenes/constants/ground-materials'
import { GROUND_WEAR_LOOKS } from '@/features/trade-scenes/constants/ground-wear-looks'
import { ATTIC_JOIST_XS, ATTIC_SPANS, HOUSE, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { LOT_PALETTE } from '@/features/trade-scenes/constants/home-lot'
import { HOME_PAINT_KEYS } from '@/features/trade-scenes/constants/home-thermal-zones'
import { DEFAULT_LAYOUT } from '@/features/trade-scenes/constants/layout-fixtures'
import { CONCRETE_TEXTURE, SOLID_MAP_KEY, STUCCO_TEXTURE, TEXTURE_SETS } from '@/features/trade-scenes/constants/material-textures'
import { isStuccoFinish } from '@/features/trade-scenes/constants/system-parts'
import { atticInsulationBoxes, atticInsulationTop, insulationTextureSet } from '@/features/trade-scenes/lib/attic-insulation-boxes'
import { packAppearance, readAppearance } from '@/features/trade-scenes/lib/ground-appearance'
import { groundDraw, lotTextureRequests } from '@/features/trade-scenes/lib/ground-draw'
import { roofUndersideY } from '@/features/trade-scenes/lib/roof-underside'
import { nextTextureBinding } from '@/features/trade-scenes/lib/texture-binding'
import { textureMapUrls } from '@/features/trade-scenes/lib/texture-map-urls'
import { wearShift } from '@/features/trade-scenes/lib/wear-shift'
import { groundStripGeometry } from '@/features/trade-scenes/ui/lib/ground-strip-geometry'
import { mergeBoxes } from '@/features/trade-scenes/ui/lib/merge-boxes'
import { patchTexturedShader } from '@/features/trade-scenes/ui/lib/patch-textured-material'
import { readyLoader } from '@/features/trade-scenes/ui/lib/ready-loader'
import { createTextureStore, MissingTextureError } from '@/features/trade-scenes/ui/lib/texture-store'
import { textureStoreFor } from '@/features/trade-scenes/ui/lib/texture-store-for'
import { createThermalPaintSet, paintThermal } from '@/features/trade-scenes/ui/lib/thermal-paint-set'
import { wallSkinLook } from '@/features/trade-scenes/ui/lib/wall-skin-look'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

function uvOf(geometry: BufferGeometry, keep: (nx: number, ny: number, nz: number) => boolean) {
  const normal = geometry.getAttribute('normal')
  const uv = geometry.getAttribute('uv')
  const us: number[] = []
  const vs: number[] = []
  for (let i = 0; i < normal.count; i++) {
    if (keep(normal.getX(i), normal.getY(i), normal.getZ(i))) {
      us.push(uv.getX(i))
      vs.push(uv.getY(i))
    }
  }
  const range = (values: number[]) => [Math.min(...values), Math.max(...values)] as const
  return { u: range(us), v: range(vs), count: us.length }
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-4
const top = (_nx: number, ny: number) => ny > 0.9
const east = (nx: number) => nx > 0.9

const flat = mergeBoxes([{ size: [3, 0.1, 2], position: [10, 0, 5] }], 0, 'metres')
const flatTop = uvOf(flat, top)
assert.ok(flatTop.count > 0 && near(flatTop.u[0], 8.5) && near(flatTop.u[1], 11.5) && near(flatTop.v[0], 4) && near(flatTop.v[1], 6), 'a_box_face_maps_in_metres')
const flatEast = uvOf(flat, east)
assert.ok(flatEast.count > 0 && near(flatEast.u[0], 4) && near(flatEast.u[1], 6) && near(flatEast.v[0], -0.05) && near(flatEast.v[1], 0.05), 'a_box_face_maps_in_metres_on_x_faces')

const tilted = mergeBoxes([{ size: [2, 0.04, 4], position: [0, 0, 0], rotation: [0.1, 0, 0] }], 0, 'metres')
const tiltedTop = uvOf(tilted, top)
assert.ok(tiltedTop.count > 0 && near(tiltedTop.u[1] - tiltedTop.u[0], 2) && near(tiltedTop.v[1] - tiltedTop.v[0], 4), 'a_tilted_slab_keeps_its_size')

const rounded = mergeBoxes([{ size: [1, 0.5, 1], position: [0, 0, 0] }], 0.03, 'metres')
const roundedTop = uvOf(rounded, top)
assert.ok(roundedTop.count > 0 && roundedTop.u[1] - roundedTop.u[0] <= 1 + 1e-4, 'a_rounded_box_stays_within_its_size')

const unchanged = uvOf(mergeBoxes([{ size: [3, 0.1, 2], position: [10, 0, 5] }]), top)
assert.ok(near(unchanged.u[0], 0) && near(unchanged.u[1], 1) && near(unchanged.v[0], 0) && near(unchanged.v[1], 1), 'the_default_is_unchanged')

function thermalMaterialOf(solid: boolean) {
  const material = new MeshStandardMaterial({ transparent: true, map: new Texture() })
  if (solid) {
    material.userData[SOLID_MAP_KEY] = true
  }
  const group = new Group()
  group.userData.thermalZone = 'exterior'
  const mesh = new Mesh(undefined, material)
  group.add(mesh)
  const values = Object.fromEntries(HOME_PAINT_KEYS.map((key, index) => [key, index / HOME_PAINT_KEYS.length])) as Parameters<typeof createThermalPaintSet>[0]
  paintThermal(group, createThermalPaintSet(values), new Set())
  return mesh.material
}

assert.ok(thermalMaterialOf(true) instanceof ShaderMaterial, 'a_ghosted_textured_wall_paints_solid')
assert.ok(thermalMaterialOf(false) instanceof MeshBasicMaterial, 'a_real_decal_keeps_its_shape')

const gravel = textureMapUrls('gravel', 'own')
assert.ok(gravel.color === '/scenes/textures/gravel/c.ktx2' && gravel.sibling === '/scenes/textures/gravel/g.ktx2', 'an_own_map_names_its_grey_sibling')
const tuscan = textureMapUrls('pavers-courtyard', { blend: 'tuscan' })
assert.ok(tuscan.color === '/scenes/textures/pavers-courtyard/c-tuscan.ktx2' && tuscan.sibling === null && tuscan.normal === '/scenes/textures/pavers-courtyard/n.ktx2', 'a_blend_names_its_own_file')
assert.equal(textureMapUrls('stucco', 'grey').sibling, null, 'a_grey_only_set_has_no_sibling')

function fakeLoads() {
  const calls: { request: TextureRequest, resolve: (texture: Texture) => void, reject: (error: unknown) => void }[] = []
  const load = (request: TextureRequest) => new Promise<Texture>((resolve, reject) => {
    calls.push({ request, resolve, reject })
  })
  const waiting = new Set<() => void>()
  const whenBack = (retry: () => void) => {
    const once = () => {
      waiting.delete(once)
      retry()
    }
    waiting.add(once)
    return () => {
      waiting.delete(once)
    }
  }
  const comeBack = () => [...waiting].forEach(retry => retry())
  const last = (url: string) => calls.filter(call => call.request.url === url).at(-1)
  return { calls, load, whenBack, comeBack, waiting, last }
}

function fakeTimers() {
  const pending = new Map<number, { run: () => void, ms: number }>()
  let next = 0
  const timers: StoreTimers = {
    setTimeout: (run, ms) => {
      next++
      pending.set(next, { run, ms })
      return next
    },
    clearTimeout: (handle) => {
      pending.delete(handle as number)
    },
  }
  const delays = () => [...pending.values()].map(({ ms }) => ms).sort((a, b) => a - b)
  const fire = (ms: number) => [...pending].filter(([, timer]) => timer.ms === ms).forEach(([id, timer]) => {
    pending.delete(id)
    timer.run()
  })
  return { timers, delays, fire }
}

function disposable() {
  const texture = new Texture()
  let disposed = 0
  texture.addEventListener('dispose', () => {
    disposed++
  })
  return { texture, disposed: () => disposed }
}

function listen(method: 'error' | 'warn') {
  const real = console[method]
  const said: string[] = []
  console[method] = (...args: unknown[]) => {
    said.push(args.map(String).join(' '))
  }
  return { said, restore: () => {
    console[method] = real
  } }
}

const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms))
async function waitFor(check: () => boolean, label: string) {
  for (let i = 0; i < 200 && !check(); i++) {
    await tick(5)
  }
  assert.ok(check(), `${label}: timed out`)
}
function noChange(): void {}
const STONE = { url: '/scenes/textures/stucco/g.ktx2', tileMetres: 2 }
const RETRIES = [2000, 8000, 30000]
const LINGER = 5000

function storeOf(fake: ReturnType<typeof fakeLoads>, lingerMs: number, timers?: StoreTimers) {
  return createTextureStore(fake.load, { lingerMs, retryDelaysMs: RETRIES, whenBack: fake.whenBack, timers })
}

{
  const fake = fakeLoads()
  const store = storeOf(fake, 0)
  let heard = 0
  store.acquire(STONE, () => heard++)
  store.acquire(STONE, () => heard++)
  const { texture } = disposable()
  fake.calls[0].resolve(texture)
  await tick()
  assert.ok(fake.calls.length === 1 && heard === 2 && store.get(STONE.url) === texture, 'one_load_per_url')
}

{
  const fake = fakeLoads()
  const store = storeOf(fake, 0)
  const release = store.acquire(STONE, noChange)
  const map = disposable()
  fake.calls[0].resolve(map.texture)
  await tick()
  release()
  await tick()
  assert.ok(map.disposed() === 1 && store.get(STONE.url) === null, 'released_maps_leave_memory')
}

{
  const fake = fakeLoads()
  const store = storeOf(fake, 50)
  const release = store.acquire(STONE, noChange)
  const map = disposable()
  fake.calls[0].resolve(map.texture)
  await tick()
  release()
  store.acquire(STONE, noChange)
  await tick(80)
  assert.ok(map.disposed() === 0 && store.get(STONE.url) === map.texture && fake.calls.length === 1, 'reacquired_within_linger_is_kept')
}

{
  const fake = fakeLoads()
  const store = storeOf(fake, 0)
  let heard = 0
  const release = store.acquire(STONE, () => heard++)
  release()
  await tick()
  const late = disposable()
  fake.calls[0].resolve(late.texture)
  await tick()
  assert.ok(late.disposed() === 1 && heard === 0 && store.get(STONE.url) === null, 'a_late_arrival_is_thrown_away')
}

{
  const fake = fakeLoads()
  const clock = fakeTimers()
  const store = storeOf(fake, LINGER, clock.timers)
  let heard = 0
  store.acquire(STONE, () => heard++)
  const scheduled: number[][] = []
  for (const delay of RETRIES) {
    fake.last(STONE.url)?.reject(new Error('timeout'))
    await tick()
    scheduled.push(clock.delays())
    clock.fire(delay)
  }
  assert.deepEqual(scheduled, [[2000], [8000], [30000]], 'a_transient_failure_retries_after_2_8_30_s')
  assert.deepEqual([fake.calls.length, heard, store.get(STONE.url)], [4, 0, null], 'a_transient_failure_retries_after_2_8_30_s: each wait ends in one load, the surface still flat')
  fake.last(STONE.url)?.reject(new Error('503'))
  await tick()
  assert.deepEqual([clock.delays().length, fake.waiting.size], [0, 1], 'after_the_schedule_it_waits_to_come_back')
  fake.comeBack()
  assert.deepEqual([fake.calls.length, fake.waiting.size], [5, 0], 'coming_back_retries')
  fake.last(STONE.url)?.reject(new Error('timeout'))
  await tick()
  assert.deepEqual(clock.delays(), [2000], 'coming_back_retries: the next failure starts the schedule again')
  clock.fire(2000)
  const { texture } = disposable()
  fake.last(STONE.url)?.resolve(texture)
  await tick()
  assert.deepEqual([fake.calls.length, heard, store.get(STONE.url) === texture], [6, 1, true], 'coming_back_retries: the map arrives in the end')
}

{
  const fake = fakeLoads()
  const clock = fakeTimers()
  const store = storeOf(fake, LINGER, clock.timers)
  const release = store.acquire(STONE, noChange)
  fake.calls[0].reject(new Error('timeout'))
  await tick()
  release()
  const left = clock.delays()
  clock.fire(2000)
  fake.comeBack()
  assert.ok(left.length === 1 && left[0] === LINGER && fake.calls.length === 1, 'a_released_map_stops_retrying')

  const brick = { url: '/scenes/textures/brick/g.ktx2', tileMetres: 1 }
  const releaseBrick = store.acquire(brick, noChange)
  for (const delay of RETRIES) {
    fake.last(brick.url)?.reject(new Error('timeout'))
    await tick()
    clock.fire(delay)
  }
  fake.last(brick.url)?.reject(new Error('timeout'))
  await tick()
  const waited = fake.waiting.size
  releaseBrick()
  assert.ok(waited === 1 && fake.waiting.size === 0, 'a_released_map_stops_retrying: it stops waiting to come back')
}

{
  const fake = fakeLoads()
  const clock = fakeTimers()
  const store = storeOf(fake, LINGER, clock.timers)
  const errors = listen('error')
  try {
    const release = store.acquire(STONE, noChange)
    fake.calls[0].reject(new MissingTextureError('404'))
    await tick()
    const noRetry = clock.delays().length === 0 && fake.waiting.size === 0
    fake.comeBack()
    release()
    clock.fire(LINGER)
    store.acquire(STONE, noChange)
    await tick()
    assert.ok(noRetry && fake.calls.length === 1 && store.get(STONE.url) === null, 'a_missing_file_is_never_retried')
    assert.ok(errors.said.length === 1 && errors.said[0].includes(STONE.url), 'a_missing_file_is_never_retried: logged once, by url')
  }
  finally {
    errors.restore()
  }
}

{
  const fake = fakeLoads()
  const clock = fakeTimers()
  const store = storeOf(fake, LINGER, clock.timers)
  const [lingering, shown, failing, waiting] = ['l', 's', 'f', 'w'].map(name => ({ url: `/scenes/textures/${name}.ktx2`, tileMetres: 1 }))
  const releaseLingering = store.acquire(lingering, noChange)
  store.acquire(shown, noChange)
  const lingeringMap = disposable()
  const shownMap = disposable()
  fake.last(lingering.url)?.resolve(lingeringMap.texture)
  fake.last(shown.url)?.resolve(shownMap.texture)
  await tick()
  releaseLingering()
  store.acquire(waiting, noChange)
  for (const delay of RETRIES) {
    fake.last(waiting.url)?.reject(new Error('timeout'))
    await tick()
    clock.fire(delay)
  }
  fake.last(waiting.url)?.reject(new Error('timeout'))
  store.acquire(failing, noChange)
  fake.last(failing.url)?.reject(new Error('timeout'))
  await tick()
  const before = { delays: clock.delays(), waiting: fake.waiting.size }
  store.dispose()
  assert.deepEqual(before, { delays: [2000, LINGER], waiting: 1 }, 'dispose_frees_everything: a linger, a retry and a wait were pending')
  assert.ok(lingeringMap.disposed() === 1 && shownMap.disposed() === 1 && store.get(shown.url) === null, 'dispose_frees_everything: every map')
  assert.ok(clock.delays().length === 0 && fake.waiting.size === 0, 'dispose_frees_everything: every timer and listener')
}

{
  const fake = fakeLoads()
  const clock = fakeTimers()
  const store = storeOf(fake, LINGER, clock.timers)
  let heard = 0
  const release = store.acquire(STONE, () => heard++)
  const brick = { url: '/scenes/textures/brick/g.ktx2', tileMetres: 1 }
  store.acquire(brick, noChange)
  store.dispose()
  const late = disposable()
  fake.last(STONE.url)?.resolve(late.texture)
  fake.last(brick.url)?.reject(new Error('timeout'))
  await tick()
  release()
  const after = store.acquire(STONE, () => heard++)
  await tick()
  after()
  assert.ok(late.disposed() === 1 && heard === 0 && store.get(STONE.url) === null && fake.calls.length === 2, 'a_load_landing_after_dispose_is_disposed_and_never_handed_out')
  assert.ok(clock.delays().length === 0 && fake.waiting.size === 0, 'a_load_landing_after_dispose_is_disposed_and_never_handed_out: a late failure schedules nothing')
}

{
  const fake = fakeLoads()
  const clock = fakeTimers()
  const store = storeOf(fake, LINGER, clock.timers)
  const release = store.acquire(STONE, noChange)
  release()
  fake.calls[0].reject(new Error('offline'))
  await tick()
  fake.comeBack()
  assert.ok(fake.calls.length === 1 && !clock.delays().includes(2000), 'a_failure_with_no_holders_does_not_retry')
}

const waiting = nextTextureBinding({ shown: 'a', wanted: 'a' }, 'b', false)
const arrived = nextTextureBinding(waiting.state, 'b', true)
assert.ok(waiting.state.shown === 'a' && waiting.release === null && arrived.state.shown === 'b' && arrived.release === 'a', 'the_shown_maps_stay_until_the_new_ones_are_ready')

const pickedBack = nextTextureBinding(nextTextureBinding({ shown: 'a', wanted: 'a' }, 'b', false).state, 'a', true)
assert.ok(pickedBack.state.shown === 'a' && pickedBack.release === null, 'a_pick_back_before_arrival_releases_nothing_shown')

{
  const shader = {
    vertexShader: ShaderLib.standard.vertexShader,
    fragmentShader: ShaderLib.standard.fragmentShader,
    uniforms: UniformsUtils.clone(ShaderLib.standard.uniforms),
  } as WebGLProgramParametersWithUniforms
  const uniforms = { uMapIn: { value: 0 }, uMapTint: { value: new Color(1, 1, 1) } }
  patchTexturedShader(shader, uniforms)
  const fragment = shader.fragmentShader
  const vertex = shader.vertexShader
  const afterUv = vertex.slice(vertex.indexOf('#include <uv_vertex>'))
  const instancing = afterUv.slice(afterUv.indexOf('#ifdef USE_INSTANCING'), afterUv.indexOf('#endif'))
  assert.ok(
    fragment.includes('uniform float uMapIn;')
    && fragment.includes('uniform vec3 uMapTint;')
    && !fragment.includes('#include <map_fragment>')
    && shader.uniforms.uMapIn === uniforms.uMapIn
    && shader.uniforms.uMapTint === uniforms.uMapTint
    && vertex.includes('#include <uv_vertex>')
    && afterUv.includes('#ifdef USE_INSTANCING')
    && ['vMapUv =', 'vNormalMapUv =', 'vRoughnessMapUv ='].every(write => instancing.includes(write)),
    'the_patch_declares_and_shares_its_uniforms',
  )
}

{
  let created = 0
  let disposed = 0
  let online = false
  const ready = readyLoader(() => {
    created++
    // Like three's KTX2Loader, the first init's outcome is kept for the loader's life.
    const pending = online ? Promise.resolve() : Promise.reject(new Error('offline'))
    pending.catch(() => {})
    return { init: () => pending, dispose: () => disposed++ }
  })
  const first = await ready.get().then(() => 'loaded', () => 'failed')
  online = true
  const second = await ready.get().then(() => 'loaded', () => 'failed')
  const third = await ready.get().then(() => 'loaded', () => 'failed')
  assert.ok(first === 'failed' && second === 'loaded' && third === 'loaded' && created === 2 && disposed === 1, 'a_failed_transcoder_is_fetched_again')
}

{
  let created = 0
  let disposed = 0
  let finish = () => {}
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  const ready = readyLoader(() => {
    created++
    return { init: () => pending, dispose: () => disposed++ }
  })
  const got = ready.get().then(() => 'loaded', () => 'refused')
  ready.dispose()
  await tick()
  const early = disposed
  finish()
  await got
  await tick()
  const after = await ready.get().then(() => 'loaded', () => 'refused')
  assert.ok(early === 0 && disposed === 1, 'a_disposed_loader_ends_once_its_init_settles')
  assert.ok(created === 1 && after === 'refused', 'a_disposed_loader_is_never_rebuilt')
}

{
  const RealRequest = globalThis.Request
  const realFetch = globalThis.fetch
  const realInit = KTX2Loader.prototype.init
  const realDispose = KTX2Loader.prototype.dispose
  const started = new WeakSet<KTX2Loader>()
  let live = 0
  KTX2Loader.prototype.init = function (this: KTX2Loader) {
    if (!started.has(this)) {
      started.add(this)
      live++
    }
    return realInit.call(this)
  }
  KTX2Loader.prototype.dispose = function (this: KTX2Loader) {
    live--
    return realDispose.call(this)
  }
  const hadProgressEvent = 'ProgressEvent' in globalThis
  // three's FileLoader builds a Request from the bare path, which Node cannot resolve without an origin, and reports a body's
  // progress with a browser-only event.
  globalThis.ProgressEvent ??= class extends Event {} as unknown as typeof ProgressEvent
  globalThis.Request = class extends RealRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(typeof input === 'string' ? new URL(input, 'http://scene.test') : input, init)
    }
  } as typeof Request
  const statuses: Record<string, number> = { '/t/gone.ktx2': 404, '/t/flaky.ktx2': 503 }
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const { pathname } = new URL(input instanceof Request ? input.url : String(input))
    return pathname.startsWith('/scenes/basis/') ? new Response(new Uint8Array(8)) : new Response(null, { status: statuses[pathname] ?? 404 })
  }) as typeof fetch
  const gl = { extensions: { has: () => false }, capabilities: { getMaxAnisotropy: () => 8 } } as unknown as WebGLRenderer
  const fake = fakeLoads()
  const clock = fakeTimers()
  const warns = listen('warn')
  const errors = listen('error')
  try {
    const gone = { url: '/t/gone.ktx2', tileMetres: 1 }
    const flaky = { url: '/t/flaky.ktx2', tileMetres: 1 }
    const first = textureStoreFor(gl, { whenBack: fake.whenBack, timers: clock.timers })
    first.acquire(gone, noChange)
    first.acquire(flaky, noChange)
    await waitFor(() => errors.said.length === 1 && clock.delays().length === 1, 'a_4xx_is_missing_and_a_5xx_is_retried')
    assert.ok(errors.said[0].includes(gone.url) && clock.delays()[0] === 2000 && live === 1, 'a_4xx_is_missing_and_a_5xx_is_retried')
    first.dispose()
    await tick()
    assert.deepEqual([live, clock.delays().length], [0, 0], 'a_disposed_store_ends_its_loader')
    const second = textureStoreFor(gl, { whenBack: fake.whenBack, timers: clock.timers })
    second.acquire(flaky, noChange)
    await waitFor(() => clock.delays().length === 1, 'a_remount_leaves_one_live_loader')
    assert.ok(live === 1 && !warns.said.some(warning => warning.includes('Multiple active KTX2 loaders')), 'a_remount_leaves_one_live_loader')
    second.dispose()
    await tick()
    assert.equal(live, 0, 'a_remount_leaves_one_live_loader: and none once it is gone')
  }
  finally {
    warns.restore()
    errors.restore()
    globalThis.Request = RealRequest
    globalThis.fetch = realFetch
    if (!hadProgressEvent) {
      delete (globalThis as { ProgressEvent?: unknown }).ProgressEvent
    }
    KTX2Loader.prototype.init = realInit
    KTX2Loader.prototype.dispose = realDispose
  }
}

assert.ok(isStuccoFinish('stucco-finish') && !isStuccoFinish('siding') && !isStuccoFinish(null), 'a_stucco_home_takes_the_plaster')

const stuccoSkin = wallSkinLook(null, '#ffffff', true)
const sidingSkin = wallSkinLook(null, '#ffffff', false)
assert.deepEqual(stuccoSkin.texture, STUCCO_TEXTURE, 'the_skin_carries_the_texture')
assert.ok(stuccoSkin.color === '#ffffff' && sidingSkin.texture === undefined && sidingSkin.color === '#ffffff', 'the_skin_carries_the_texture: a siding home keeps flat paint and the colour stays the paint')

const homeKit = (file: string) => readFileSync(`src/features/trade-scenes/ui/components/home-kit/${file}.tsx`, 'utf8').split('\n')
const bodySites: Record<string, number> = { 'house-shell': 5, 'gable-roof': 2, 'foundation': 2, 'low-slope-roof': 3, 'garage': 2, 'garage-gable-end': 1 }
for (const [file, sites] of Object.entries(bodySites)) {
  const lines = homeKit(file)
  const textured = lines.filter(line => /skin\.texture|\{\.\.\.texture\}/.test(line))
  assert.equal(textured.length, sites, `every_body_site_passes_the_skin_texture: ${file} has ${textured.length} of ${sites}`)
  const flatParts = lines.filter(line => /texture/.test(line) && /paint\.trim|FASCIA|COPING|DOOR|fascia|trimColor/.test(line))
  assert.equal(flatParts.length, 0, `every_body_site_passes_the_skin_texture: ${file} textures a trim, fascia or door line`)
}

{
  const covering = homeKit('covering-material').join('\n')
  const shingleChild = covering.match(/if \(shape === 'shingle'\) \{\s*return (<TexturedMaterial[^>]*\/>)/)
  assert.ok(shingleChild !== null && /set="shingle"/.test(shingleChild[1]) && !/extend=/.test(shingleChild[1]) && (covering.match(/<TexturedMaterial/g) ?? []).length === 1, 'shingles_take_the_grit')
  assert.ok(!homeKit('roof-covering').join('\n').includes('<TexturedMaterial'), 'shingles_take_the_grit: through the covering\'s own material alone')
}

{
  const deep = atticInsulationBoxes('batts-r38', false, ATTIC_SPANS.open)
  const gaps = ATTIC_JOIST_XS.slice(1).map((x, index) => [ATTIC_JOIST_XS[index], x] as const)
  assert.ok(deep.every(({ size, position }) => gaps.some(([from, to]) => position[0] - size[0] / 2 >= from && position[0] + size[0] / 2 <= to)), 'deep_batts_are_one_panel_per_bay')
  const tops = deep.map(({ size, position }) => position[1] + size[1] / 2)
  assert.ok(Math.abs(Math.max(...tops) - (WALL_TOP_Y + 0.31)) < 1e-9, 'deep_batts_stand_above_the_joists')
  const byWall = [...deep].sort((a, b) => Math.abs(a.position[2]) - Math.abs(b.position[2]))
  const topOf = ({ size, position }: (typeof deep)[number]) => position[1] + size[1] / 2
  assert.ok(topOf(byWall[byWall.length - 1]) < topOf(byWall[0]), 'deep_batts_step_down_at_the_eaves: the wall end is lower')
  assert.ok(byWall.every((box, index) => index === 0 || topOf(box) <= topOf(byWall[index - 1]) + 1e-9), 'deep_batts_step_down_at_the_eaves: tops never rise toward the wall')
  assert.ok(deep.every(box => [box.position[2] - box.size[2] / 2, box.position[2] + box.size[2] / 2].every(z => topOf(box) - roofUndersideY(z, 'pitched') <= 1e-9)), 'deep_batts_step_down_at_the_eaves: none rises past the roof underside')
  for (const box of [byWall[0], byWall[byWall.length - 1]]) {
    assert.ok(Math.abs(atticInsulationTop('batts-r38', false, box.position[2]) - topOf(box)) < 1e-9, 'the_top_height_still_reports')
  }
  assert.equal(atticInsulationBoxes('batts-r11', false, ATTIC_SPANS.open).length, ATTIC_JOIST_XS.length - 1, 'shallow_batts_are_unchanged: one box per bay')
  const blown = atticInsulationBoxes('blown-r38', false, ATTIC_SPANS.open)
  assert.ok(blown.every(box => box.size[0] > HOUSE.halfLength), 'shallow_batts_are_unchanged: blown still runs across the joists')
  assert.ok(insulationTextureSet('batts-r38') === 'fiber-batt' && insulationTextureSet('blown-r38') === 'fiber-blown', 'insulation_picks_its_texture_set')
}

{
  const uv = groundStripGeometry([[-3, 0], [5, 0]], 7, 1).getAttribute('uv')
  const position = groundStripGeometry([[-3, 0], [5, 0]], 7, 1).getAttribute('position')
  assert.ok(uv.count > 0 && Array.from({ length: uv.count }, (_, i) => i).every(i => uv.getX(i) === position.getX(i) && uv.getY(i) === position.getZ(i)), 'the_lawn_maps_in_metres')
}

{
  const flatLines = (file: string, pattern: RegExp) => readFileSync(`src/features/trade-scenes/ui/components/${file}.tsx`, 'utf8').split('\n').filter(line => pattern.test(line))
  for (const [file, pattern] of [['home-kit/lot', /concreteJoints|blockWalls|wallCaps|fenceBoards|fenceRails/], ['layout-kit/layout-lot', /wallCaps|fenceBoards|fenceRails/]] as const) {
    const lines = flatLines(file, pattern)
    assert.ok(lines.length > 0 && lines.every(line => !/texture/.test(line)), `joints_and_fences_stay_flat: ${file}`)
  }
}

{
  for (const [id, material] of Object.entries(GROUND_MATERIALS)) {
    const set = material.look.texture
    assert.ok(set === undefined || set in TEXTURE_SETS, `every_textured_material_names_a_set: ${id}`)
  }
  const named = Object.entries(GROUND_MATERIALS).filter(([, material]) => material.look.texture !== undefined).map(([id, material]) => `${id}:${material.look.texture}`).sort()
  assert.deepEqual(named, ['asphalt:asphalt', 'concrete:concrete', 'gravel:gravel', 'mulch:mulch', 'pavers:pavers-courtyard', 'sod:sod-healthy', 'turf:turf'], 'every_textured_material_names_a_set: the set per material')
}

{
  const sodGood = groundDraw('sod', 'good', 0)
  const sodWorn = groundDraw('sod', 'worn', 0)
  const sodFailing = groundDraw('sod', 'failing', 0)
  assert.ok(sodGood?.set === 'sod-healthy' && sodGood.map === 'own' && sodGood.marks === null, 'sod: good draws the healthy lawn with no marks')
  assert.ok(sodWorn?.set === 'sod-worn' && sodWorn.map === 'own' && sodWorn.marks === 'lawn', 'sod: worn draws the worn lawn with its marks')
  assert.ok(sodFailing?.set === 'sod-worn' && sodFailing.marks === 'lawn', 'sod: failing draws the worn lawn with its marks')

  const asphaltNatural = groundDraw('asphalt', 'good', 0)
  assert.ok(asphaltNatural?.set === 'asphalt' && asphaltNatural.map === 'own', 'asphalt: good at appearance 0 draws its own colours')
  const sealed = groundDraw('asphalt', 'good', packAppearance(0, 2))
  assert.ok(sealed?.set === 'asphalt' && sealed.map === 'grey' && sealed.mapTint === '#3d3d40', 'asphalt: good and Sealed draws the grey map tinted')
  for (const appearance of [0, packAppearance(0, 2), packAppearance(0, 4)]) {
    const worn = groundDraw('asphalt', 'worn', appearance)
    assert.ok(worn?.set === 'asphalt-worn' && worn.map === 'own' && worn.mapTint === null, `asphalt: worn keeps its own colours at appearance ${appearance}`)
  }

  const cracked = groundDraw('concrete', 'failing', 0)
  assert.ok(cracked?.set === 'concrete' && cracked.marks === 'paving', 'concrete: failing keeps the concrete and lays paving marks')

  const wornGravel = groundDraw('gravel', 'worn', 0)
  assert.ok(wornGravel?.set === 'gravel' && wornGravel.shade !== null && wornGravel.marks === null, 'gravel: worn keeps the gravel, shaded, with no marks')

  const courtyard = groundDraw('pavers', 'good', 0)
  assert.ok(courtyard?.set === 'pavers-courtyard', 'pavers: appearance 0 draws Courtyard Stone')
  assert.deepEqual(courtyard?.map, { blend: 'dark-gray-pewter-charcoal' }, 'pavers: appearance 0 draws the default blend')
  const herringbone = groundDraw('pavers', 'good', packAppearance(2, 4))
  assert.ok(herringbone?.set === 'pavers-herringbone' && herringbone.map === 'grey' && herringbone.mapTint === '#a36048', 'pavers: Herringbone in Terracotta draws the grey map tinted')

  for (const material of ['dg', 'river-rock', 'dirt', 'pool'] as const) {
    assert.equal(groundDraw(material, 'good', 0), null, `${material}: has no texture`)
  }

  assert.equal(readAppearance('gravel', packAppearance(0, 15))?.color.name, 'Natural', 'an_out_of_range_colour_reads_natural')

  const { lawn, paving } = GROUND_WEAR_LOOKS
  assert.ok(lawn.failing.marks > lawn.worn.marks, 'failing_is_worse_than_worn: lawn bare soil')
  assert.ok(paving.failing.marks > paving.worn.marks && paving.failing.breaks > paving.worn.breaks, 'failing_is_worse_than_worn: paving cracks and breaks')

  const fading = groundDraw('mulch', 'failing', 0)?.shade
  const mulch = GROUND_MATERIALS.mulch.look.color
  assert.ok(fading !== null && fading !== undefined && wearShift(mulch, wornColor(mulch, LOT_PALETTE[fading.tint], fading.amount)).every(channel => channel > 1), 'worn_mulch_fades_lighter')
  const shift = new Color().setRGB(...wearShift(mulch, wornColor(mulch, LOT_PALETTE.fade, 0.3)))
  const fresh = new Color(mulch)
  assert.equal(`#${fresh.multiply(shift).getHexString()}`, wornColor(mulch, LOT_PALETTE.fade, 0.3), 'worn_mulch_fades_lighter: the shift lands today\'s worn colour at the mean')

  const tiles = DEFAULT_LAYOUT.lot.cols * DEFAULT_LAYOUT.lot.rows
  const lot = {
    ...DEFAULT_LAYOUT.lot,
    existing: new Uint8Array(tiles).fill(GROUND_MATERIAL_INDEX.gravel),
    proposed: new Uint8Array(tiles).fill(GROUND_MATERIAL_INDEX.pavers),
    wear: new Uint8Array(tiles).fill(GROUND_WEAR_INDEX.good),
  }
  const requests = lotTextureRequests(lot)
  const held = (set: string) => requests.filter(request => request.set === set)
  assert.ok(held('gravel').length === 1 && held('pavers-courtyard').length === 1, 'both_layers_are_held')
}

{
  assert.deepEqual(CONCRETE_TEXTURE, { set: 'concrete', map: 'own' }, 'every_concrete_part_wears_the_concrete_map')
  const concreteSites: [string, RegExp][] = [['home-kit/foundation', /boxes=\{STEPS\}/], ['home-kit/foundation', /boxes=\{SLAB\}/], ['home-kit/foundation', /boxes=\{STOOP\}/], ['home-kit/condenser-unit', /boxes=\{PAD\}/], ['home-kit/lot', /boxes=\{LOT_BOXES\.concrete\}/], ['layout-kit/layout-lot', /boxes=\{boxes\.concrete\}/]]
  for (const [file, site] of concreteSites) {
    const line = readFileSync(`src/features/trade-scenes/ui/components/${file}.tsx`, 'utf8').split('\n').find(candidate => site.test(candidate))
    assert.ok(line?.includes('texture={CONCRETE_TEXTURE}'), `every_concrete_part_wears_the_concrete_map: ${file}`)
  }
}

console.log('verify-material-textures: ok')
