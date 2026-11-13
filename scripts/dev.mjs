#!/usr/bin/env node
// `pnpm dev`: the public dev port is served by a small router; the real
// `next dev` runs behind it on an internal port and is managed by this script.
//
//   DEV_IDLE_MIN      stop the dev server after this many minutes without an
//                     HTTP request (default 30; 0 = never). The next request
//                     starts it again (~15 s + compile).
//   DEV_MEM_LIMIT_GB  restart the dev server once its process tree passes this
//                     (default 6; 0 = off). Turbopack grows without bound.
//   DEV_EAGER         1 (default) starts the dev server immediately, as before;
//                     0 waits for the first request.
//
// Only HTTP requests count as activity and wake a stopped server. Hot-reload
// WebSocket reconnects from an idle tab do neither.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { getPort } from './lib/get-port.mjs'
import { startMemGuard } from './lib/mem-guard.mjs'
import { createRouter, findFreePort, waitForPort } from './lib/dev-router.mjs'

// Dev runs on Turbopack; production builds stay on webpack (`next build`).
// `pnpm dev --webpack` is the fallback when Turbopack misbehaves — if the bug
// only shows on Turbopack, it will not reach production, but note it.
const useWebpack = process.argv.includes('--webpack')

const publicPort = getPort()
const idleMin = Number(process.env.DEV_IDLE_MIN ?? 30)
const limitGb = Number(process.env.DEV_MEM_LIMIT_GB ?? 6)
const eager = process.env.DEV_EAGER !== '0'

const log = msg => console.error(`[dev] ${new Date().toLocaleTimeString()} ${msg}`)

let child = null // running `next dev` process, or null
let internalPort = null
let starting = null // promise while the server is coming up
let startedAt = 0
let stopping = null // promise while an intentional stop is in flight
let failedUntil = 0 // back-off after a start that died at once
let lastActivity = Date.now()

// `pnpm dev` puts node_modules/.bin on PATH; `node scripts/dev.mjs` does not.
const nextBin = [resolve(process.cwd(), 'node_modules/.bin/next')].find(existsSync) ?? 'next'

function spawnNext(port) {
  const args = ['dev', '--port', String(port)]
  if (!useWebpack) args.push('--turbopack')
  // Own process group so a stop takes the whole tree (next-server, postcss
  // workers) with it. Signals are forwarded explicitly below.
  return spawn(nextBin, args, { stdio: 'inherit', shell: false, detached: true })
}

function signalTree(proc, signal) {
  if (!proc || proc.exitCode !== null) return
  try {
    process.kill(-proc.pid, signal)
  } catch {
    proc.kill(signal)
  }
}

function start() {
  if (starting) return starting
  if (Date.now() < failedUntil) {
    return Promise.reject(new Error(`last start failed; retrying after ${Math.ceil((failedUntil - Date.now()) / 1000)}s`))
  }
  starting = (async () => {
    internalPort = await findFreePort(publicPort + 1000)
    const proc = spawnNext(internalPort)
    child = proc
    startedAt = Date.now()
    log(`starting next dev on internal :${internalPort}`)
    const gone = new Promise((_, reject) => {
      const handle = what => {
        reject(new Error(what))
        if (child !== proc) return
        child = null
        internalPort = null
        if (!stopping) {
          // Not one of ours: a crash, an OOM kill, or a failed spawn. Back off
          // so a broken setup does not retry on every request.
          if (Date.now() - startedAt < 10_000) failedUntil = Date.now() + 15_000
          log(`${what}; will start again on the next request`)
        }
      }
      proc.once('error', err => handle(`cannot start ${nextBin}: ${err.message}`))
      proc.once('exit', code => handle(`next dev exited (code ${code ?? 'signal'})`))
    })
    gone.catch(() => {}) // observed through the race below
    try {
      await Promise.race([waitForPort(internalPort), gone])
    } catch (err) {
      signalTree(proc, 'SIGKILL')
      throw err
    }
    log(`ready: http://localhost:${publicPort} (proxied to :${internalPort})`)
  })()
  starting.finally(() => {
    starting = null
  })
  return starting
}

function stop(reason) {
  if (!child) return Promise.resolve()
  if (stopping) return stopping
  const proc = child
  log(`stopping next dev (${reason})`)
  stopping = new Promise(resolve => {
    const done = () => {
      clearTimeout(hardKill)
      stopping = null
      resolve()
    }
    proc.once('exit', done)
    signalTree(proc, 'SIGTERM')
    const hardKill = setTimeout(() => signalTree(proc, 'SIGKILL'), 10_000)
    hardKill.unref()
  })
  return stopping
}

async function ensureRunning() {
  if (stopping) await stopping
  if (child && !starting) return
  await start()
}

const router = createRouter({
  target: () => (child && !starting ? internalPort : null),
  ensureRunning,
  onActivity: () => {
    lastActivity = Date.now()
  },
  log,
})

router.listen(publicPort, () => {
  log(`listening on http://localhost:${publicPort}` + (idleMin ? ` · stops after ${idleMin} min idle` : '') + (limitGb ? ` · restarts above ${limitGb} GB` : ''))
  if (eager) start().catch(err => log(err.message))
})

if (idleMin > 0) {
  setInterval(() => {
    if (!child || starting || stopping) return
    const idleFor = Date.now() - lastActivity
    if (idleFor >= idleMin * 60_000) stop(`idle ${Math.round(idleFor / 60_000)} min`)
  }, 15_000).unref()
}

if (limitGb > 0) {
  startMemGuard({
    getPid: () => (child && !starting && !stopping ? child.pid : null),
    getStartedAt: () => startedAt,
    restart: () => stop('memory limit').then(() => start()).catch(err => log(err.message)),
    limitBytes: limitGb * 2 ** 30,
    log,
  })
}

function shutdown(signal) {
  log(`${signal}: shutting down`)
  router.close()
  const proc = child
  child = null
  stopping = Promise.resolve()
  signalTree(proc, 'SIGTERM')
  setTimeout(() => {
    signalTree(proc, 'SIGKILL')
    process.exit(0)
  }, 5_000).unref()
  if (!proc || proc.exitCode !== null) process.exit(0)
  proc.once('exit', () => process.exit(0))
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
