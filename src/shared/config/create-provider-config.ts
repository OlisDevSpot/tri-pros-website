import type { z } from 'zod'

import process from 'node:process'

import { NotConfiguredError } from '@/shared/config/not-configured-error'

/**
 * Why this factory validates its OWN `fragment` against `process.env` instead
 * of importing the parsed `env` singleton from `server-env`:
 *
 * Every provider's `lib/config.ts` imports THIS module (for the factory) and is
 * in turn imported BY `server-env` (which spreads each `xEnvFragment` into the
 * central schema). If the factory ALSO imported `server-env`, that closes a
 * module-init cycle:
 *
 *   provider/lib/config.ts → create-provider-config → server-env
 *     → (back to) provider/lib/config.ts for its `xEnvFragment`
 *
 * ESM hoists imports, so when the graph is entered through a provider config
 * (e.g. the CloudTalk webhook route → cloudtalk/client → cloudtalk/lib/config),
 * server-env would evaluate `...xEnvFragment.shape` while that fragment is still
 * in the temporal dead zone → "Cannot access 'cloudtalkEnvFragment' before
 * initialization".
 *
 * The factory doesn't need the aggregated singleton — it already receives the
 * provider's own `fragment`. `get()` runs that fragment against `process.env`,
 * which makes the fragment the per-provider safety gate it was designed to be:
 * a misconfigured provider throws at ITS call site (NotConfiguredError for a
 * missing required key; a scoped ZodError for a present-but-invalid value like
 * cloudtalk's `.min(32)` secret) rather than crashing app boot. server-env keeps
 * every fragment `.optional()` in the central schema, so boot still never fails
 * on an unconfigured provider; this re-parse simply scopes validation to the
 * one provider being used.
 */

/**
 * Shape of the boot-banner registry entry every provider's `lib/config.ts`
 * produces. server-env iterates the set of registered metas after parse
 * and prints one line per provider.
 *
 * `provider` is the canonical provider identifier (twilio, cloudtalk,
 * resend, etc.) — distinct from internal "services" (services/voip/*),
 * which are app code, not third-party integrations.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 */
export interface ConfigMeta<TProvider extends string = string> {
  readonly provider: TProvider
  readonly isConfigured: () => boolean
  readonly listMissing: () => string[]
}

/**
 * Bundle of helpers a provider's `lib/config.ts` exports after factoring.
 *
 * - `build`: pure narrowing builder (parsed env → required-typed config).
 *   Throws `NotConfiguredError` listing every missing required key.
 * - `get`: cached lazy accessor — the public entry point for callers.
 *   Reads the singleton `env`, calls `build`, caches the result.
 * - `isConfigured`: boolean peek — never throws. Used for feature gates
 *   and the boot banner.
 * - `configMeta`: registry entry consumed by server-env's boot banner.
 */
export interface ProviderConfigHelpers<TParsed, TConfig, TProvider extends string> {
  build: (parsed: TParsed) => TConfig
  get: () => TConfig
  isConfigured: () => boolean
  configMeta: ConfigMeta<TProvider>
}

/**
 * Factory for the five-export shape codified in
 * `provider-env-config-when-optional`. Replaces ~80 lines of boilerplate
 * per provider with a single call.
 *
 * Each provider's `lib/config.ts` defines:
 *   1. The Zod fragment (all fields `.optional()`)
 *   2. The runtime config interface (required types)
 *   3. The mapping (parsed → runtime)
 * and calls `createProviderConfig({...})` to get the helper bundle
 * (`{ build, get, isConfigured, configMeta }`). Re-export the `<x>EnvFragment`
 * (server-env spreads it) plus only the helpers a provider actually uses —
 * always `getXConfig` + `xConfigMeta`; add `isXConfigured` / `buildXConfig`
 * when a consumer needs them.
 *
 * @example
 * ```ts
 * export const resendEnvFragment = z.object({
 *   RESEND_API_KEY: z.string().optional(),
 * })
 * export interface ResendRuntimeConfig { apiKey: string }
 *
 * const helpers = createProviderConfig({
 *   provider: 'resend',
 *   fragment: resendEnvFragment,
 *   requiredKeys: ['RESEND_API_KEY'],
 *   toConfig: (parsed): ResendRuntimeConfig => ({ apiKey: parsed.RESEND_API_KEY! }),
 * })
 *
 * export const getResendConfig = helpers.get
 * export const resendConfigMeta = helpers.configMeta
 * ```
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 */
export function createProviderConfig<
  TProvider extends string,
  TFragment extends z.ZodObject<z.ZodRawShape>,
  TConfig,
>(opts: {
  provider: TProvider
  fragment: TFragment
  requiredKeys: ReadonlyArray<keyof z.infer<TFragment>>
  toConfig: (parsed: z.infer<TFragment>) => TConfig
}): ProviderConfigHelpers<z.infer<TFragment>, TConfig, TProvider> {
  type TParsed = z.infer<TFragment>

  function listMissing(): string[] {
    return opts.requiredKeys
      .filter(k => !process.env[k as string])
      .map(String)
  }

  function build(parsed: TParsed): TConfig {
    const missing = opts.requiredKeys
      .filter(k => !parsed[k])
      .map(String)
    if (missing.length > 0) {
      throw new NotConfiguredError(opts.provider, missing)
    }
    return opts.toConfig(parsed)
  }

  let _cache: TConfig | null = null
  function get(): TConfig {
    if (_cache !== null) {
      return _cache
    }
    // Validate this provider's own slice — throws a scoped error on a
    // present-but-invalid value; `build` handles missing required keys.
    _cache = build(opts.fragment.parse(process.env))
    return _cache
  }

  function isConfigured(): boolean {
    return listMissing().length === 0
  }

  const configMeta: ConfigMeta<TProvider> = {
    provider: opts.provider,
    isConfigured,
    listMissing,
  } as const

  return { build, get, isConfigured, configMeta }
}
