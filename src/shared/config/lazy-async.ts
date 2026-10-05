/**
 * Memoize an async factory: the first call starts it and later calls share the
 * same promise. A rejection is not cached, so the next call retries — the same
 * recovery `lazyProxy` has when its factory throws.
 *
 * Use case: provider SDKs loaded with `import()` on first use. A static import
 * puts the SDK in the server bundle of every route that imports the tRPC app
 * router, and a cold start compiles all of it; `import()` gets its own chunk,
 * read only when called.
 */
export function lazyAsync<T>(factory: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined
  return () => {
    pending ??= factory().catch((error: unknown) => {
      pending = undefined
      throw error
    })
    return pending
  }
}
