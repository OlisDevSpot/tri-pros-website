// Word-level caption generation: VO audio + known script → wordCaptions in a
// props JSON. Whisper DTW gives the timing; the known script fixes ASR words
// (numerals, mishears) so captions can never say the wrong thing.
// Usage: node scripts/transcribe.mjs --audio public/audio/vo.mp3 \
//          --script "exact VO text" --props props/reel.json
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { downloadWhisperModel, installWhisperCpp, toCaptions, transcribe } from '@remotion/install-whisper-cpp'

const args = process.argv.slice(2)
function arg(name) {
  const i = args.indexOf(`--${name}`)
  if (i === -1 || !args[i + 1])
    throw new Error(`Missing --${name}`)
  return args[i + 1]
}

// whisper is spawned with its own cwd — all paths must be absolute.
const audioPath = path.resolve(arg('audio'))
const script = arg('script')
const propsPath = path.resolve(arg('props'))

const WHISPER_DIR = path.join(process.cwd(), '.whisper')
const WHISPER_VERSION = '1.5.5' // docs-recommended pin for token-level timestamps
const MODEL = 'small.en' // plenty for clean TTS; boundaries come from DTW, not model size

await installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSION })
await downloadWhisperModel({ model: MODEL, folder: WHISPER_DIR })

// whisper.cpp requires 16-bit 16kHz WAV
const wavPath = audioPath.replace(/\.[a-z0-9]+$/i, '.16k.wav')
execFileSync('pnpm', ['exec', 'remotion', 'ffmpeg', '-y', '-i', audioPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wavPath], { stdio: 'inherit' })

const output = await transcribe({
  inputPath: wavPath,
  whisperPath: WHISPER_DIR,
  whisperCppVersion: WHISPER_VERSION,
  model: MODEL,
  tokenLevelTimestamps: true,
})
const { captions } = toCaptions({ whisperCppOutput: output })

// Reconcile: the OUTPUT is always exactly the script words (never ASR text —
// no "remod el"/"Triple A" fragments on screen). Matched script words take
// whisper's timing; unmatched runs get timing interpolated across the gap
// between surrounding matches (which is where the garbled ASR tokens live).
const normalize = w => w.toLowerCase().replace(/[^a-z0-9']/g, '')
const scriptWords = script.split(/\s+/).filter(Boolean)
const a = captions.map(c => normalize(c.text))
const b = scriptWords.map(normalize)

const lcs = Array.from({ length: a.length + 1 }, () => Array.from({ length: b.length + 1 }, () => 0))
for (let i = a.length - 1; i >= 0; i--) {
  for (let j = b.length - 1; j >= 0; j--)
    lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
}
const asrIndexForScript = Array.from({ length: b.length }, () => null)
{
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j] && a[i] !== '') {
      asrIndexForScript[j] = i
      i++
      j++
    }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      i++
    }
    else {
      j++
    }
  }
}

const audioEndMs = captions.at(-1)?.endMs ?? 0
const result = []
for (let j = 0; j < b.length; j++) {
  if (asrIndexForScript[j] !== null)
    continue // filled below from whisper
  // find the unmatched run [j, runEnd)
  let runEnd = j
  while (runEnd < b.length && asrIndexForScript[runEnd] === null) runEnd++
  const prevAsr = j > 0 ? captions[asrIndexForScript[j - 1]] : null
  const nextAsr = runEnd < b.length ? captions[asrIndexForScript[runEnd]] : null
  const windowStart = prevAsr ? prevAsr.endMs : (captions[0]?.startMs ?? 0)
  const windowEnd = nextAsr ? nextAsr.startMs : audioEndMs
  const slot = Math.max(windowEnd - windowStart, 1) / (runEnd - j)
  for (let k = j; k < runEnd; k++) {
    result[k] = {
      startMs: windowStart + slot * (k - j),
      endMs: windowStart + slot * (k - j + 1),
      timestampMs: null,
      confidence: null,
    }
  }
  j = runEnd - 1
}
for (let j = 0; j < b.length; j++) {
  if (asrIndexForScript[j] !== null) {
    const c = captions[asrIndexForScript[j]]
    result[j] = { startMs: c.startMs, endMs: c.endMs, timestampMs: c.timestampMs ?? null, confidence: c.confidence ?? null }
  }
}

const matched = asrIndexForScript.filter(x => x !== null).length
const matchRatio = matched / Math.max(b.length, 1)
if (matchRatio < 0.7)
  console.warn(`⚠️  Only ${Math.round(matchRatio * 100)}% of script words matched ASR — check the audio/script pairing.`)

const props = JSON.parse(readFileSync(propsPath, 'utf8'))
props.wordCaptions = scriptWords.map((word, j) => ({
  text: `${j === 0 ? '' : ' '}${word}`,
  ...result[j],
}))
writeFileSync(propsPath, `${JSON.stringify(props, null, 2)}\n`)
console.log(`✅ ${scriptWords.length} word captions (${Math.round(matchRatio * 100)}% script match) → ${propsPath}`)
