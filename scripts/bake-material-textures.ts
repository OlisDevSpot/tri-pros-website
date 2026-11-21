import type { TextureSetId } from '@/features/trade-scenes/types'
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'

import sharp from 'sharp'
import { ROUGHNESS_MAP_MEAN, TEXTURE_SETS } from '@/features/trade-scenes/constants/material-textures'

const SIZE = 1024
const FINE_NORMAL_SIZE = 512
const GREY_MEAN = 0.8

// Where each set's maps come from, relative to the archive.
const SOURCES: Record<TextureSetId, string> = {
  'shingle': 'sources/Asphalt031',
  'stucco': 'sources/Plaster004',
  'sod-healthy': 'sources/Grass004',
  'sod-worn': 'sources/grass_ground',
  'turf': 'generated/turf-lush',
  'gravel': 'sources/Gravel023',
  'mulch': 'generated/mulch-chips',
  'concrete': 'sources/Concrete048',
  'asphalt': 'sources/Road012A',
  'asphalt-worn': 'sources/asphalt_02',
  'pavers-courtyard': 'sources/courtyard',
  'pavers-wave': 'sources/PavingStones071',
  'pavers-herringbone': 'sources/PavingStones081',
  'pavers-ashlar': 'sources/PavingStones077',
  'pavers-small-herringbone': 'sources/PavingStones108',
  'pavers-interlocking': 'sources/PavingStones099',
  'pavers-tumbled': 'sources/concrete_pavers_02',
  'fiber-blown': 'generated/fiber-blown',
  'fiber-batt': 'generated/fiber-pink',
}

// Grain this fine turns to noise at full size, and the opening view has to fit its download budget.
const FINE_NORMAL_SETS = new Set<TextureSetId>(['sod-healthy', 'sod-worn', 'gravel', 'turf'])

// toktx 4.4.2 documents this flag as --wmode but only accepts --wrapping.
const COLOR_FLAGS = ['--t2', '--encode', 'etc1s', '--qlevel', '200', '--genmipmap', '--wrapping', 'wrap', '--target_type', 'RGB']
const NORMAL_FLAGS = ['--t2', '--encode', 'uastc', '--uastc_quality', '2', '--zcmp', '18', '--genmipmap', '--wrapping', 'wrap', '--assign_oetf', 'linear', '--target_type', 'RGB']

function arg(name: string) {
  const at = process.argv.indexOf(name)
  const value = at === -1 ? undefined : process.argv[at + 1]
  if (!value) {
    throw new Error(`missing ${name}`)
  }
  return value
}

const archive = resolve(arg('--from'))
const toktx = resolve(arg('--toktx'))
const libDir = join(dirname(toktx), '..', 'lib')
const env = { ...process.env, LD_LIBRARY_PATH: [existsSync(libDir) ? libDir : '', process.env.LD_LIBRARY_PATH ?? ''].filter(Boolean).join(':') }
const outRoot = join(process.cwd(), 'public/scenes/textures')
const work = mkdtempSync(join(tmpdir(), 'bake-textures-'))

function sourceFile(dir: string, name: string) {
  const found = ['jpg', 'webp', 'png'].map(ext => join(dir, `${name}.${ext}`)).find(existsSync)
  if (!found) {
    throw new Error(`no ${name} image in ${dir}`)
  }
  return found
}

async function lumaOf(file: string, size: number) {
  const { data } = await sharp(file).resize(size, size, { fit: 'cover' }).grayscale().raw().toBuffer({ resolveWithObject: true })
  return data
}

function meanOf(data: Uint8Array) {
  let sum = 0
  for (const v of data) {
    sum += v
  }
  return sum / data.length / 255
}

function greyPixels(data: Uint8Array) {
  const gamma = Math.max(0.5, Math.log(GREY_MEAN) / Math.log(meanOf(data)))
  const lifted = new Float32Array(data.length)
  let after = 0
  for (let i = 0; i < data.length; i++) {
    lifted[i] = (data[i] / 255) ** gamma
    after += lifted[i]
  }
  const gain = GREY_MEAN / (after / data.length)
  const out = Buffer.alloc(data.length)
  for (let i = 0; i < data.length; i++) {
    out[i] = Math.min(255, lifted[i] * gain * 255)
  }
  return out
}

function roughnessPixels(data: Uint8Array) {
  const gain = ROUGHNESS_MAP_MEAN / meanOf(data)
  const out = Buffer.alloc(data.length)
  for (let i = 0; i < data.length; i++) {
    out[i] = Math.min(255, data[i] * gain)
  }
  return out
}

async function writeGreyPng(pixels: Buffer, path: string) {
  await sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 1 } }).toColourspace('srgb').png().toFile(path)
}

function encode(png: string, out: string, flags: string[]) {
  execFileSync(toktx, [...flags, out, png], { env, stdio: ['ignore', 'ignore', 'inherit'] })
  return statSync(out).size
}

async function bakeSet(id: TextureSetId) {
  const set = TEXTURE_SETS[id]
  const from = join(archive, SOURCES[id])
  const dir = join(outRoot, id)
  mkdirSync(dir, { recursive: true })
  const sizes: Record<string, number> = {}
  const colorFlags = (oetf: string) => [...COLOR_FLAGS, '--assign_oetf', oetf]
  const png = join(work, `${id}.png`)

  for (const blend of set.blends ?? []) {
    await sharp(sourceFile(from, `c-${blend}`)).resize(SIZE, SIZE, { fit: 'cover' }).png().toFile(png)
    sizes[`c-${blend}`] = encode(png, join(dir, `c-${blend}.ktx2`), colorFlags('srgb'))
  }
  if (set.maps.includes('own')) {
    await sharp(sourceFile(from, 'c')).resize(SIZE, SIZE, { fit: 'cover' }).png().toFile(png)
    sizes.c = encode(png, join(dir, 'c.ktx2'), colorFlags('srgb'))
  }
  if (set.maps.includes('grey')) {
    await writeGreyPng(greyPixels(await lumaOf(sourceFile(from, 'c'), SIZE)), png)
    sizes.g = encode(png, join(dir, 'g.ktx2'), colorFlags('srgb'))
  }

  const normalSize = FINE_NORMAL_SETS.has(id) ? FINE_NORMAL_SIZE : SIZE
  await sharp(sourceFile(from, 'n')).resize(normalSize, normalSize, { fit: 'cover' }).png().toFile(png)
  sizes.n = encode(png, join(dir, 'n.ktx2'), NORMAL_FLAGS)

  await writeGreyPng(roughnessPixels(await lumaOf(sourceFile(from, 'r'), SIZE)), png)
  sizes.r = encode(png, join(dir, 'r.ktx2'), colorFlags('linear'))

  const total = Object.values(sizes).reduce((a, b) => a + b, 0)
  console.log(`${id}: ${Object.entries(sizes).map(([k, v]) => `${k} ${(v / 1024).toFixed(0)}K`).join(', ')} = ${(total / 1024).toFixed(0)} KB`)
  return total
}

let grand = 0
try {
  for (const id of Object.keys(TEXTURE_SETS) as TextureSetId[]) {
    grand += await bakeSet(id)
  }
}
finally {
  rmSync(work, { recursive: true, force: true })
}
console.log(`total ${(grand / 1048576).toFixed(1)} MB`)
