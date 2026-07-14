import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { normalizeKenBurns, showcaseReelSchema } from './schema'

const propsDir = path.join(import.meta.dirname, '../../props')

test('back-compat: both shipped props files parse without edits', () => {
  for (const file of ['kitchens-showcase-reel-02.json', 'bathrooms-showcase-reel-01.json']) {
    const raw = JSON.parse(readFileSync(path.join(propsDir, file), 'utf8'))
    const parsed = showcaseReelSchema.parse(raw)
    assert.equal(parsed.hookStyle, 'wordStagger') // new fields default in
    assert.equal(parsed.clips[0]!.cardStyle, 'native')
    assert.deepEqual(parsed.colorPops, [])
  }
})

test('new knobs accept the full menus', () => {
  const raw = JSON.parse(readFileSync(path.join(propsDir, 'kitchens-showcase-reel-02.json'), 'utf8'))
  raw.hookStyle = 'typewriter'
  raw.colorPops = [300]
  raw.screenShakes = [{ frame: 756, intensity: 0.8 }]
  raw.clips[2].transitionIn = 'whip'
  raw.clips[2].transitionDirection = 'up'
  raw.clips[2].cardStyle = 'polaroid'
  raw.clips[4].cardStyle = 'split'
  raw.clips[4].secondarySrc = 'stills/after.jpg'
  raw.clips[0].kenBurns = { zoom: 'out', pan: 'left' }
  raw.photoBurst.style = 'polaroid-scatter'
  raw.wordCaptions[11].emphasis = true
  const parsed = showcaseReelSchema.parse(raw)
  assert.equal(parsed.clips[2]!.transitionIn, 'whip')
  assert.deepEqual(parsed.clips[0]!.kenBurns, { zoom: 'out', pan: 'left' })
})

test('normalizeKenBurns maps legacy strings and passes objects through', () => {
  assert.deepEqual(normalizeKenBurns('in'), { zoom: 'in', pan: 'none' })
  assert.deepEqual(normalizeKenBurns('out'), { zoom: 'out', pan: 'none' })
  assert.deepEqual(normalizeKenBurns({ zoom: 'in', pan: 'right' }), { zoom: 'in', pan: 'right' })
  assert.deepEqual(normalizeKenBurns(undefined), { zoom: 'in', pan: 'none' }) // raw-props safety
})
