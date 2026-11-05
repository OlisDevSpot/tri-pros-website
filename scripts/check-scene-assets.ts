import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const HOME_DIR = join(process.cwd(), 'public/scenes/home')
const MAX_BYTES = 4 * 1024 * 1024
const MAX_FIGURES = 5

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
