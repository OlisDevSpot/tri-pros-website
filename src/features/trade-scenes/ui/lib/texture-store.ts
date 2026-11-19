import type { Texture } from 'three'

export interface TextureRequest {
  url: string
  tileMetres: number
}

export interface TextureStore {
  acquire: (request: TextureRequest, onChange: () => void) => () => void
  get: (url: string) => Texture | null
  dispose: () => void
}

// A load rejects with this when the file is not there: asking again cannot bring it.
export class MissingTextureError extends Error {}

export interface StoreTimers {
  setTimeout: (run: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
}

interface StoreOptions {
  // A map released and asked for again within this long (a Today ⇄ Build toggle, a blend picked back) is not reloaded.
  lingerMs: number
  // The waits before each try again after a failed load, while something still holds the map.
  retryDelaysMs: readonly number[]
  // Once those waits run out: calls back once when the connection may be back, and returns how to stop waiting.
  whenBack: (retry: () => void) => () => void
  timers?: StoreTimers
}

interface Entry {
  request: TextureRequest
  texture: Texture | null
  loading: boolean
  holders: Set<() => void>
  linger: unknown
  retry: unknown
  stopWaiting: (() => void) | null
  failures: number
}

// Wrapped, since a browser's setTimeout called off `window` throws.
const GLOBAL_TIMERS: StoreTimers = {
  setTimeout: (run, ms) => setTimeout(run, ms),
  clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

function noRelease(): void {}

// One texture per url, shared by every material that binds it, freed from GPU memory once nothing holds it. Disposing the
// store frees everything it ever loaded, at once.
export function createTextureStore(load: (request: TextureRequest) => Promise<Texture>, { lingerMs, retryDelaysMs, whenBack, timers = GLOBAL_TIMERS }: StoreOptions): TextureStore {
  const entries = new Map<string, Entry>()
  const missing = new Set<string>()
  let disposed = false

  const isCurrent = (entry: Entry) => entries.get(entry.request.url) === entry
  const isHeld = (entry: Entry) => isCurrent(entry) && entry.holders.size > 0

  function stopRetrying(entry: Entry): void {
    if (entry.retry !== null) {
      timers.clearTimeout(entry.retry)
      entry.retry = null
    }
    entry.stopWaiting?.()
    entry.stopWaiting = null
    entry.failures = 0
  }

  function retryLater(entry: Entry): void {
    const delay = retryDelaysMs[entry.failures]
    if (delay !== undefined) {
      entry.failures++
      entry.retry = timers.setTimeout(() => {
        entry.retry = null
        if (isHeld(entry)) {
          start(entry)
        }
      }, delay)
      return
    }
    entry.stopWaiting = whenBack(() => {
      entry.stopWaiting = null
      entry.failures = 0
      if (isHeld(entry)) {
        start(entry)
      }
    })
  }

  function start(entry: Entry): void {
    const waiting = entry.retry !== null || entry.stopWaiting !== null
    if (entry.loading || entry.texture !== null || waiting || missing.has(entry.request.url)) {
      return
    }
    entry.loading = true
    load(entry.request).then(
      (texture) => {
        entry.loading = false
        // Released and forgotten, or the store disposed, while it was on its way: nothing will ever bind it.
        if (!isCurrent(entry)) {
          texture.dispose()
          return
        }
        entry.failures = 0
        entry.texture = texture
        entry.holders.forEach(onChange => onChange())
      },
      (error: unknown) => {
        entry.loading = false
        if (!isCurrent(entry)) {
          return
        }
        // Either way the surface keeps today's flat colour; only a file that is there is worth asking for again.
        if (error instanceof MissingTextureError) {
          missing.add(entry.request.url)
          console.error(`Texture ${entry.request.url} is missing; its surface stays flat colour.`, error)
          return
        }
        if (entry.holders.size > 0) {
          retryLater(entry)
        }
      },
    )
  }

  function release(entry: Entry): void {
    if (entry.holders.size > 0 || !isCurrent(entry)) {
      return
    }
    stopRetrying(entry)
    entry.linger = timers.setTimeout(() => {
      entry.linger = null
      if (entry.holders.size > 0 || !isCurrent(entry)) {
        return
      }
      entries.delete(entry.request.url)
      entry.texture?.dispose()
      entry.texture = null
    }, lingerMs)
  }

  return {
    acquire(request, onChange) {
      if (disposed) {
        return noRelease
      }
      const entry = entries.get(request.url) ?? { request, texture: null, loading: false, holders: new Set(), linger: null, retry: null, stopWaiting: null, failures: 0 }
      entries.set(request.url, entry)
      if (entry.linger !== null) {
        timers.clearTimeout(entry.linger)
        entry.linger = null
      }
      // A holder of its own, so the same listener acquired twice is still released twice.
      const holder = () => onChange()
      entry.holders.add(holder)
      start(entry)
      let held = true
      return () => {
        if (!held) {
          return
        }
        held = false
        entry.holders.delete(holder)
        release(entry)
      }
    },
    get(url) {
      return entries.get(url)?.texture ?? null
    },
    dispose() {
      disposed = true
      entries.forEach((entry) => {
        if (entry.linger !== null) {
          timers.clearTimeout(entry.linger)
          entry.linger = null
        }
        stopRetrying(entry)
        entry.texture?.dispose()
        entry.texture = null
        entry.holders.clear()
      })
      entries.clear()
    },
  }
}
