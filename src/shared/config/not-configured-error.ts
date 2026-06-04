/**
 * Thrown by provider / service-domain `getXConfig()` accessors when their
 * env vars are missing at call time. Lets callers `instanceof` to route a
 * configured-vs-misconfigured response (e.g., tRPC error formatter →
 * structured 503 instead of opaque 500).
 *
 * Schema layer accepts every provider env as `.optional()` so app boot
 * never fails on a provider that isn't in use. Required-ness is enforced
 * here, at the call site that actually needs the keys.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 */
export class NotConfiguredError extends Error {
  readonly service: string
  readonly missingVars: readonly string[]

  constructor(service: string, missingVars: string[]) {
    super(
      `${service} is not configured for this environment. Missing env vars: ${missingVars.join(', ')}. `
      + `Set them in Vercel or .env.local to enable ${service}-backed features.`,
    )
    this.name = 'NotConfiguredError'
    this.service = service
    this.missingVars = missingVars
  }
}
