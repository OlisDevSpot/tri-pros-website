import assert from 'node:assert/strict'
import { PWA_LAUNCH_COVER_MAX_MS, PWA_LAUNCH_COVER_MIN_MS } from '@/shared/domains/pwa/constants/launch'
import { createPwaLaunchStore } from '@/shared/domains/pwa/lib/launch-store'

function clock() {
  let now = 0
  let nextId = 1
  const timers = new Map<number, { at: number, fn: () => void }>()
  return {
    timers: {
      now: () => now,
      setTimeout: (fn: () => void, ms: number) => {
        const id = nextId++
        timers.set(id, { at: now + ms, fn })
        return id
      },
      clearTimeout: (handle: unknown) => {
        timers.delete(handle as number)
      },
    },
    advance(ms: number) {
      now += ms
      const due = [...timers].filter(([, t]) => t.at <= now).sort((a, b) => a[1].at - b[1].at)
      for (const [id, t] of due) {
        timers.delete(id)
        t.fn()
      }
    },
  }
}

{
  const c = clock()
  const s = createPwaLaunchStore(c.timers)
  assert.equal(s.phase(), 'idle')
  assert.equal(s.wasShellLaunch(), false)
  s.ready()
  assert.equal(s.phase(), 'idle', 'ready before begin is a no-op')
  s.begin()
  assert.equal(s.phase(), 'covering')
  assert.equal(s.wasShellLaunch(), true)
  c.advance(PWA_LAUNCH_COVER_MIN_MS + 50)
  s.ready()
  c.advance(0)
  assert.equal(s.phase(), 'done', 'ready past the floor finishes at once')
}

{
  const c = clock()
  const s = createPwaLaunchStore(c.timers)
  s.begin()
  c.advance(100)
  s.ready()
  assert.equal(s.phase(), 'covering', 'still covering under the floor')
  c.advance(PWA_LAUNCH_COVER_MIN_MS - 100)
  assert.equal(s.phase(), 'done', 'finishes exactly at the floor')
}

{
  const c = clock()
  const s = createPwaLaunchStore(c.timers)
  s.begin()
  c.advance(PWA_LAUNCH_COVER_MAX_MS - 1)
  assert.equal(s.phase(), 'covering')
  c.advance(1)
  assert.equal(s.phase(), 'done', 'the bound ends it')
  s.begin()
  assert.equal(s.phase(), 'done', 'begin after done is a no-op')
}

{
  const c = clock()
  const s = createPwaLaunchStore(c.timers)
  const seen: string[] = []
  const unsubscribe = s.subscribe(() => seen.push(s.phase()))
  s.begin()
  s.begin()
  c.advance(PWA_LAUNCH_COVER_MIN_MS)
  s.ready()
  s.ready()
  c.advance(0)
  assert.deepEqual(seen, ['covering', 'done'], 'subscribers hear each change once')
  unsubscribe()
}

console.log('✅ pwa launch store verified')
