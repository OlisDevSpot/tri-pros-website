interface InitLoader {
  init: () => Promise<unknown>
  dispose: () => unknown
}

export interface ReadyLoader<L> {
  get: () => Promise<L>
  dispose: () => void
}

// three's KTX2Loader caches its transcoder fetch, a failed one included, so a loader whose init failed (offline) would fail
// every later load; it is dropped and the next load builds a fresh one. Once disposed, none is built again.
export function readyLoader<L extends InitLoader>(create: () => L): ReadyLoader<L> {
  let current: L | null = null
  let disposed = false
  return {
    async get() {
      if (disposed) {
        throw new Error('The loader was disposed')
      }
      const loader = current ?? create()
      current = loader
      try {
        await loader.init()
      }
      catch (error) {
        if (current === loader) {
          loader.dispose()
          current = null
        }
        throw error
      }
      return loader
    },
    dispose() {
      disposed = true
      const loader = current
      current = null
      // Not before its init settles: KTX2Loader builds its worker source when the transcoder arrives, and one built after
      // dispose would never be revoked. Work already handed to it queued on the same init, so it goes first.
      const end = () => loader?.dispose()
      loader?.init().then(end, end)
    },
  }
}
