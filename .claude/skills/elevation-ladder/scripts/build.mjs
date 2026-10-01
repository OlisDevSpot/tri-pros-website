// Fills the ladder template with the picked values (ladder.json) and any measured
// comparison presets, and writes a page ready to publish as an artifact.
//
//   node build.mjs --out /tmp/elevation-ladder.html /tmp/current.json /tmp/live.json
//
// The proposed scenes borrow text colours (ink, muted ink, primary, rail) from the
// preset whose id is "current" when one is given, so only surfaces differ.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const HERE = path.dirname(new URL(import.meta.url).pathname)
const SKILL = path.resolve(HERE, '..')

const argv = process.argv.slice(2)
const outAt = argv.indexOf('--out')
if (outAt === -1 || !argv[outAt + 1]) {
  console.error('usage: node build.mjs --out <file.html> [measured.json ...]')
  process.exit(2)
}
const out = argv[outAt + 1]
const measured = argv.filter((_, i) => i !== outAt && i !== outAt + 1).map(f => JSON.parse(readFileSync(f, 'utf8')))

const ladder = JSON.parse(readFileSync(path.join(SKILL, 'ladder.json'), 'utf8'))
const current = measured.find(m => m.id === 'current')
const strip = ({ raw, ...mode }) => mode

const config = {
  project: ladder.project,
  picked: ladder.picked,
  rail: ladder.rail,
  text: current ? { light: current.light.text, dark: current.dark.text } : ladder.fallbackText,
  compare: measured.map(m => ({ id: m.id, label: m.label, source: m.source, note: `Measured from ${m.source} on ${m.measuredAt.slice(0, 10)}.`, light: strip(m.light), dark: strip(m.dark) })),
}

const template = readFileSync(path.join(SKILL, 'assets', 'ladder-template.html'), 'utf8')
// JSON inside a <script> block must not contain a literal closing tag.
const json = JSON.stringify(config).replaceAll('</', '<\\/')
writeFileSync(out, template.replace('__LADDER_CONFIG__', json))
console.log(`wrote ${out} (${measured.length} comparison preset(s))`)
