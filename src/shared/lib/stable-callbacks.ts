type Callback = (...args: unknown[]) => unknown
type Entries = Record<string, unknown>

function isPlainObject(value: unknown): value is Entries {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function sameEntries(prev: Entries, next: Entries): boolean {
  const keys = Object.keys(next)
  if (keys.length !== Object.keys(prev).length) {
    return false
  }
  return keys.every((key) => {
    if (!(key in prev)) {
      return false
    }
    const before = prev[key]
    const after = next[key]
    return (typeof before === 'function' && typeof after === 'function') || Object.is(before, after)
  })
}

/** Whether `next` differs from `prev` only in which closures its function entries hold. */
export function hasSameValues(prev: unknown, next: unknown): boolean {
  if (Array.isArray(prev) && Array.isArray(next)) {
    return prev.length === next.length && next.every((item, index) => {
      const before: unknown = prev[index]
      return isPlainObject(before) && isPlainObject(item) ? sameEntries(before, item) : Object.is(before, item)
    })
  }
  if (isPlainObject(prev) && isPlainObject(next)) {
    return sameEntries(prev, next)
  }
  return Object.is(prev, next)
}

function wrapEntries(entries: Entries, read: () => unknown): Entries {
  return Object.fromEntries(Object.entries(entries).map(([key, entry]) => [
    key,
    typeof entry === 'function'
      ? (...args: unknown[]) => {
          const latest = isPlainObject(read()) ? (read() as Entries)[key] : undefined
          // Between a render that drops this entry and its commit, the latest value no longer has it.
          return (typeof latest === 'function' ? latest as Callback : entry as Callback)(...args)
        }
      : entry,
  ]))
}

/** A copy of `value` whose function entries call whatever `read()` holds at call time. */
export function withLatestCallbacks<T>(value: T, read: () => T): T {
  if (Array.isArray(value)) {
    return value.map((item: unknown, index) =>
      isPlainObject(item) ? wrapEntries(item, () => (read() as unknown[])[index]) : item,
    ) as T
  }
  return (isPlainObject(value) ? wrapEntries(value, read) : value) as T
}
