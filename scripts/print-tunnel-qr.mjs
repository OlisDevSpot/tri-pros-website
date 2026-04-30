#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import qrcode from 'qrcode-terminal'
import { getPort } from './lib/get-port.mjs'

const TUNNEL_STARTUP_DELAY_MS = 3000

function readNgrokUrlFromEnv() {
  // .env is symlinked at the repo root and used across worktrees
  const envPath = resolve(process.cwd(), '.env')
  let contents
  try {
    contents = readFileSync(envPath, 'utf8')
  }
  catch {
    return null
  }
  const match = contents.match(/^NGROK_URL\s*=\s*(.+)$/m)
  if (!match) {
    return null
  }
  return match[1].trim().replace(/^['"]|['"]$/g, '')
}

const url = readNgrokUrlFromEnv()
if (!url) {
  console.error('[tunnel-qr] NGROK_URL not found in .env — skipping QR.')
  process.exit(0)
}

const port = getPort()

await sleep(TUNNEL_STARTUP_DELAY_MS)

console.log('')
console.log(`📱 Mobile tunnel: ${url}  →  http://localhost:${port}`)
qrcode.generate(url, { small: true })
console.log('')
