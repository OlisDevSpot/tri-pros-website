// Restarts a child process tree once its resident memory passes a limit.
//
// Turbopack dev servers grow without bound over hours (12 GB observed on a
// 64 GB machine running three of them). A restart costs ~10 s and frees all
// of it, so `pnpm dev` restarts itself instead of starving WSL. Linux/WSL only
// (reads /proc); a no-op elsewhere.
import { readdirSync, readFileSync } from 'node:fs'

const PAGE_BYTES = 4096

/** Resident set size, in bytes, of `rootPid` plus every descendant. */
export function treeRssBytes(rootPid) {
  const parentOf = new Map()
  const rssOf = new Map()
  for (const name of readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue
    const pid = Number(name)
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
      // Fields after the ")" that closes comm: state, ppid, ... rss is the 24th
      // field of the file, i.e. index 21 once state is index 0.
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
      parentOf.set(pid, Number(fields[1]))
      rssOf.set(pid, Number(fields[21]) * PAGE_BYTES)
    } catch {
      // Process exited while we were scanning.
    }
  }
  let total = 0
  const seen = new Set()
  const stack = [rootPid]
  while (stack.length) {
    const pid = stack.pop()
    if (seen.has(pid)) continue
    seen.add(pid)
    total += rssOf.get(pid) ?? 0
    for (const [child, ppid] of parentOf) if (ppid === pid) stack.push(child)
  }
  return total
}

/**
 * Polls the tree under `getPid()` and calls `restart()` when it exceeds
 * `limitBytes`. Waits `settleMs` after each (re)start (own restarts, or the
 * caller's via `getStartedAt`) before judging, and
 * gives up (with a log line) if two restarts land within `loopWindowMs`, so a
 * server that legitimately needs more than the limit is not restarted forever.
 */
export function startMemGuard({
  getPid,
  getStartedAt,
  restart,
  limitBytes,
  intervalMs = 30_000,
  settleMs = 120_000,
  loopWindowMs = 10 * 60_000,
  log = console.error,
}) {
  if (process.platform !== 'linux') return () => {}
  const gb = b => (b / 2 ** 30).toFixed(1)
  let startedAt = Date.now()
  let lastRestartAt = 0
  const timer = setInterval(() => {
    const pid = getPid()
    const since = getStartedAt ? Math.max(getStartedAt(), startedAt) : startedAt
    if (!pid || Date.now() - since < settleMs) return
    const bytes = treeRssBytes(pid)
    if (bytes <= limitBytes) return
    if (lastRestartAt && Date.now() - lastRestartAt < loopWindowMs) {
      log(`memory ${gb(bytes)} GB over the ${gb(limitBytes)} GB limit again within ${loopWindowMs / 60_000} min; guard off. Raise DEV_MEM_LIMIT_GB if this server really needs it.`)
      clearInterval(timer)
      return
    }
    lastRestartAt = startedAt = Date.now()
    log(`memory ${gb(bytes)} GB > ${gb(limitBytes)} GB limit; restarting dev server`)
    restart()
  }, intervalMs)
  timer.unref()
  return () => clearInterval(timer)
}
