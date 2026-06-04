/**
 * Wrap a factory in a Proxy that defers construction until first property
 * access. Lets a module-scope export look like an eagerly-constructed object
 * to consumers (zero call-site change) while actually being lazily built
 * on first use.
 *
 * Use case: provider clients (Resend, Notion SDK, S3Client, etc.) that
 * historically were created via `const xClient = new Sdk(env.X)` at module
 * scope — which fails at boot when `env.X` is optional+missing. Wrapping
 * the factory with `lazyProxy()` means:
 *
 *   - Module load: nothing happens. No env read.
 *   - First property access: factory runs, result cached, property returned.
 *   - Subsequent accesses: same cached instance, no re-construction.
 *
 * The factory typically calls a `getXConfig()` accessor from the provider's
 * `lib/config.ts`, which throws `NotConfiguredError` if env is missing — so
 * a method call on an unconfigured provider throws cleanly at the call site
 * instead of crashing app boot.
 *
 * Trade-off: the export is a Proxy, not the real SDK instance. Consumers
 * doing `xClient instanceof Sdk` would get `false`. Destructured references
 * (`const { something } = xClient`) eager-trigger the proxy but are otherwise
 * fine. Typical `xClient.method(...)` usage is transparent.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 */
export function lazyProxy<T extends object>(factory: () => T): T {
  let cached: T | undefined
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      cached ??= factory()
      return Reflect.get(cached, prop, receiver)
    },
  })
}
