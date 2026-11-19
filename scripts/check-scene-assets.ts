import type { TextureMapChoice, TextureSetId } from '@/features/trade-scenes/types'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import process from 'node:process'
import { OPENING_TEXTURE_SETS, TEXTURE_SETS } from '@/features/trade-scenes/constants/material-textures'
import { textureMapUrls } from '@/features/trade-scenes/lib/texture-map-urls'

const HOME_DIR = join(process.cwd(), 'public/scenes/home')
const MAX_BYTES = 4 * 1024 * 1024
const MAX_FIGURES = 5
const PUBLIC_DIR = join(process.cwd(), 'public')
const MIB = 1024 * 1024
const MAX_OPENING_BYTES = 10 * MIB
const MAX_SIZING_GPU_BYTES = 35 * MIB
const WEAR_OVERLAY_GPU_BYTES = 2.8 * MIB
const SIZING_PAVER_SETS = 3
const SIZING_COURTYARD_BLENDS = 2
const MIP_FACTOR = 4 / 3

interface GlbJson {
  animations?: { name?: string }[]
  skins?: unknown[]
}

function listGlbs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return listGlbs(path)
    }
    return entry.name.endsWith('.glb') ? [path] : []
  })
}

// Reads only the JSON chunk so this runs without three.js or a decoder.
function readGlbJson(path: string): GlbJson {
  const buf = readFileSync(path)
  if (buf.readUInt32LE(0) !== 0x46546C67) {
    throw new Error(`${path} is not a GLB`)
  }
  const jsonLength = buf.readUInt32LE(12)
  return JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8')) as GlbJson
}

const files = listGlbs(HOME_DIR)
const totalBytes = files.reduce((sum, file) => sum + statSync(file).size, 0)
const figures = files.flatMap((file) => {
  const json = readGlbJson(file)
  const clips = (json.animations ?? []).map(a => a.name ?? '(unnamed)')
  return clips.length > 0 || (json.skins ?? []).length > 0 ? [{ file, clips }] : []
})

for (const { file, clips } of figures) {
  console.log(`${file.slice(HOME_DIR.length + 1)}: ${clips.length} clips`)
  console.log(`  ${clips.join(', ')}`)
}
console.log(`${files.length} files, ${(totalBytes / 1024).toFixed(0)} KB of ${MAX_BYTES / 1024} KB`)

const problems: string[] = []

interface Ktx2Info {
  bytes: number
  pixels: number
  etc1s: boolean
}

const missingTextures: string[] = []

function ktx2Of(url: string): Ktx2Info | null {
  const path = join(PUBLIC_DIR, url)
  if (!existsSync(path)) {
    missingTextures.push(url)
    return null
  }
  const header = readFileSync(path).subarray(0, 48)
  return {
    bytes: statSync(path).size,
    pixels: header.readUInt32LE(20) * header.readUInt32LE(24),
    etc1s: header.readUInt32LE(44) === 1,
  }
}

// The iPad transcodes ETC1S to ETC2 RGB (0.5 B/px) and UASTC to ASTC 4x4 (1 B/px).
function gpuBytes(info: Ktx2Info) {
  return info.pixels * (info.etc1s ? 0.5 : 1) * MIP_FACTOR
}

function bcBytes(info: Ktx2Info) {
  return info.pixels * MIP_FACTOR
}

interface SetCost {
  fileBytes: number
  gpu: number
  gpuAllBc7: number
}

// A sibling's bytes are fetched ahead for a live colour pick but it never reaches the GPU.
function costOf(set: TextureSetId, color: TextureMapChoice, opts: { colorMap: boolean } = { colorMap: true }): SetCost {
  const urls = textureMapUrls(set, color)
  const onGpu = [opts.colorMap ? urls.color : null, urls.normal, urls.roughness].flatMap(url => url === null ? [] : [ktx2Of(url)])
  const sibling = urls.sibling === null ? null : ktx2Of(urls.sibling)
  const gpuInfos = onGpu.filter((info): info is Ktx2Info => info !== null)
  return {
    fileBytes: gpuInfos.reduce((sum, info) => sum + info.bytes, 0) + (sibling?.bytes ?? 0),
    gpu: gpuInfos.reduce((sum, info) => sum + gpuBytes(info), 0),
    gpuAllBc7: gpuInfos.reduce((sum, info) => sum + bcBytes(info), 0),
  }
}

const sum = (costs: SetCost[], key: keyof SetCost) => costs.reduce((total, cost) => total + cost[key], 0)

for (const id of Object.keys(TEXTURE_SETS) as TextureSetId[]) {
  const set = TEXTURE_SETS[id]
  const maps: TextureMapChoice[] = [...set.maps, ...(set.blends ?? []).map(blend => ({ blend }))]
  for (const map of maps) {
    const urls = textureMapUrls(id, map)
    ;[urls.color, urls.normal, urls.roughness, urls.sibling].forEach(url => url !== null && ktx2Of(url))
  }
}

const transcoderBytes = ['basis_transcoder.js', 'basis_transcoder.wasm'].reduce((total, name) => {
  const path = join(PUBLIC_DIR, 'scenes/basis', name)
  if (!existsSync(path)) {
    missingTextures.push(`scenes/basis/${name}`)
    return total
  }
  return total + statSync(path).size
}, 0)

const openingCosts = OPENING_TEXTURE_SETS.map(({ set, map }) => costOf(set, map))
const openingBytes = sum(openingCosts, 'fileBytes') + transcoderBytes

const ownMap = (set: TextureSetId): TextureMapChoice => TEXTURE_SETS[set].maps.includes('own') ? 'own' : 'grey'
const paverSets = (Object.keys(TEXTURE_SETS) as TextureSetId[]).filter(id => id.startsWith('pavers-') && id !== 'pavers-courtyard')
const otherPavers = paverSets.map(id => costOf(id, ownMap(id))).sort((a, b) => b.gpu - a.gpu).slice(0, SIZING_PAVER_SETS)
const courtyardBlends = TEXTURE_SETS['pavers-courtyard'].blends ?? []
const blendColors = courtyardBlends.slice(0, SIZING_COURTYARD_BLENDS).map(blend => ktx2Of(textureMapUrls('pavers-courtyard', { blend }).color))
const courtyardCosts: SetCost[] = [
  costOf('pavers-courtyard', { blend: courtyardBlends[0] }, { colorMap: false }),
  ...blendColors.flatMap(info => info === null ? [] : [{ fileBytes: 0, gpu: gpuBytes(info), gpuAllBc7: bcBytes(info) }]),
]
const sizingCosts = [
  ...openingCosts,
  costOf('fiber-batt', 'own'),
  ...otherPavers,
]
const sizingGpu = sum(sizingCosts, 'gpu') + sum(courtyardCosts, 'gpu') + WEAR_OVERLAY_GPU_BYTES
const sizingGpuAllBc7 = sum(sizingCosts, 'gpuAllBc7') + sum(courtyardCosts, 'gpuAllBc7') + WEAR_OVERLAY_GPU_BYTES

console.log(`textures before the opening view: ${(openingBytes / MIB).toFixed(2)} MiB of ${MAX_OPENING_BYTES / MIB} MiB (transcoder ${(transcoderBytes / 1024).toFixed(0)} KB)`)
console.log(`sizing case GPU textures: ${(sizingGpu / MIB).toFixed(2)} MiB of ${MAX_SIZING_GPU_BYTES / MIB} MiB (${(sizingGpuAllBc7 / MIB).toFixed(2)} MiB if every map landed at 1 B/px)`)

// Every shipped file needs a licence row: a file added without one would ship unlicensed with nothing to say so.
const SCENES_DIR = join(PUBLIC_DIR, 'scenes')
const LICENSES_FILE = 'LICENSES.md'
function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)])
}
const licensed = [...readFileSync(join(SCENES_DIR, LICENSES_FILE), 'utf8').matchAll(/`([^`\s]+)`/g)]
  .filter(([, pattern]) => pattern!.includes('/'))
  .map(([, pattern]) => new RegExp(`^${pattern!.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '[^/]*')}$`))
const unlicensed = listFiles(SCENES_DIR)
  .map(path => path.slice(SCENES_DIR.length + 1))
  .filter(path => path !== LICENSES_FILE && !licensed.some(pattern => pattern.test(path)))
if (unlicensed.length > 0) {
  problems.push(`no row in public/scenes/${LICENSES_FILE} for: ${unlicensed.join(', ')}`)
}

// KTX2Loader and the transcoder it drives must come from the same three release; a three upgrade leaving the old copy here
// would fail every texture quietly, each surface falling back to flat colour.
const THREE_BASIS_DIR = join(process.cwd(), 'node_modules/three/examples/jsm/libs/basis')
for (const name of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
  const ours = join(SCENES_DIR, 'basis', name)
  if (existsSync(ours) && !readFileSync(ours).equals(readFileSync(join(THREE_BASIS_DIR, name)))) {
    problems.push(`public/scenes/basis/${name} differs from the installed three's copy: copy it from ${THREE_BASIS_DIR}`)
  }
}

if (missingTextures.length > 0) {
  problems.push(`missing texture files: ${[...new Set(missingTextures)].join(', ')}`)
}
if (openingBytes > MAX_OPENING_BYTES) {
  problems.push(`opening textures are ${openingBytes} bytes, over the ${MAX_OPENING_BYTES} byte budget`)
}
if (sizingGpu > MAX_SIZING_GPU_BYTES) {
  problems.push(`sizing case needs ${Math.round(sizingGpu)} GPU bytes, over the ${MAX_SIZING_GPU_BYTES} byte budget`)
}
if (totalBytes > MAX_BYTES) {
  problems.push(`public/scenes/home is ${totalBytes} bytes, over the ${MAX_BYTES} byte budget`)
}
if (figures.length > MAX_FIGURES) {
  problems.push(`${figures.length} animated figures, over the limit of ${MAX_FIGURES}`)
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
  process.exit(1)
}
