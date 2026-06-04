import type { z } from 'zod'

import { NotConfiguredError } from '@/shared/config/not-configured-error'
import env from '@/shared/config/server-env'

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
 * and calls `createProviderConfig({...})` to get the helper bundle. The
 * five canonical exports (`<x>EnvFragment`, `build<X>Config`, `get<X>Config`,
 * `is<X>Configured`, `<x>ConfigMeta`) come from the factory result + the
 * fragment definition.
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
 * export const buildResendConfig = helpers.build
 * export const getResendConfig = helpers.get
 * export const isResendConfigured = helpers.isConfigured
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
      .filter(k => !(env as Record<string, unknown>)[k as string])
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
    _cache = build(env as unknown as TParsed)
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
