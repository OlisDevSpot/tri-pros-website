import type { z } from 'zod'

import process from 'node:process'

import { NotConfiguredError } from '@/shared/config/not-configured-error'

/**
 * `get()` parses the provider's own `fragment` against `process.env` instead of importing the `env`
 * singleton: provider lib/config → this factory → server-env → provider lib/config is a module-init
 * cycle, and entering the graph through a provider config hits its fragment in the temporal dead zone.
 * The re-parse also scopes a present-but-invalid value to the one provider in use instead of failing boot.
 */

/** `provider` is the third-party provider id (twilio, justcall, resend), never an internal service name. */
export interface ConfigMeta<TProvider extends string = string> {
  readonly provider: TProvider
  readonly isConfigured: () => boolean
  readonly listMissing: () => string[]
}

/** `get` throws on a misconfigured provider; `isConfigured` never throws (feature gates, boot banner). */
export interface ProviderConfigHelpers<TParsed, TConfig, TProvider extends string> {
  build: (parsed: TParsed) => TConfig
  get: () => TConfig
  isConfigured: () => boolean
  configMeta: ConfigMeta<TProvider>
}

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
