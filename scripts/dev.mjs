#!/usr/bin/env node
import { spawn } from 'node:child_process'
import process from 'node:process'
import { getPort } from './lib/get-port.mjs'
import { startMemGuard } from './lib/mem-guard.mjs'

// Dev runs on Turbopack; production builds stay on webpack (`next build`).
// `pnpm dev --webpack` is the fallback when Turbopack misbehaves — if the bug
// only shows on Turbopack, it will not reach production, but note it.
const useWebpack = process.argv.includes('--webpack')

const port = getPort()
const args = ['dev', '--port', String(port)]
if (!useWebpack) {
  args.push('--turbopack')
}

// Turbopack's memory grows without bound over hours, so the server restarts
// itself once its process tree passes DEV_MEM_LIMIT_GB (default 6).
// DEV_MEM_LIMIT_GB=0 turns the guard off.
const limitGb = Number(process.env.DEV_MEM_LIMIT_GB ?? 6)
const log = msg => console.error(`[dev] ${new Date().toLocaleTimeString()} ${msg}`)

let child = null
let restarting = false

function start() {
  // Own process group so a restart can take the whole tree (next-server,
  // postcss workers) with it; signals are forwarded below.
  child = spawn('next', args, { stdio: 'inherit', shell: false, detached: true })
  child.on('exit', code => {
    if (restarting) {
      restarting = false
      start()
      return
    }
    process.exit(code ?? 0)
  })
}

function signalTree(signal) {
  if (!child || child.exitCode !== null) return
  try {
    process.kill(-child.pid, signal)
  } catch {
    child.kill(signal)
  }
}

function restart() {
  restarting = true
  const pid = child.pid
  signalTree('SIGTERM')
  setTimeout(() => {
    if (child && child.pid === pid && child.exitCode === null) signalTree('SIGKILL')
  }, 10_000).unref()
}

start()
process.on('SIGINT', () => signalTree('SIGINT'))
process.on('SIGTERM', () => signalTree('SIGTERM'))

if (limitGb > 0) {
  startMemGuard({ getPid: () => child?.pid, restart, limitBytes: limitGb * 2 ** 30, log })
}
