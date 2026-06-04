/**
 * Thrown by provider `getXConfig()` accessors when their env vars are
 * missing at call time. Lets callers `instanceof` to route a configured-
 * vs-misconfigured response (e.g., tRPC error formatter → structured 503
 * instead of opaque 500).
 *
 * Schema layer accepts every provider env as `.optional()` so app boot
 * never fails on a provider that isn't in use. Required-ness is enforced
 * here, at the call site that actually needs the keys.
 *
 * `provider` is the canonical provider identifier (twilio, cloudtalk,
 * resend, etc.) — same string used in the boot banner and the
 * `xConfigMeta.provider` field. Distinct from internal "services"
 * (services/voip/*.service.ts) — those are app code, not third-party
 * integrations.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 */
export class NotConfiguredError extends Error {
  readonly provider: string
  readonly missingVars: readonly string[]

  constructor(provider: string, missingVars: string[]) {
    super(
      `${provider} is not configured for this environment. Missing env vars: ${missingVars.join(', ')}. `
      + `Set them in Vercel or .env.local to enable ${provider}-backed features.`,
    )
    this.name = 'NotConfiguredError'
    this.provider = provider
    this.missingVars = missingVars
  }
}
