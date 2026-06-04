import { v2 } from 'pipedrive'

import { getPipedriveConfig } from './lib/config'

/**
 * Pipedrive SDK Configuration object — lazy-constructed accessor.
 *
 * Consumers call `getPipedriveSdkConfig()` and pass the returned
 * Configuration into Pipedrive API factories: `new PersonsApi(getPipedriveSdkConfig())`,
 * etc. Lazy so PIPEDRIVE_API_KEY can be missing at boot — only the first
 * call into a Pipedrive API throws `NotConfiguredError`.
 *
 * Why a function (not a `lazyProxy`-wrapped const): the export is a config
 * VALUE consumed by `new SomeApi(config)`, not an object with methods,
 * so a transparent Proxy adds no ergonomic value over a plain function.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 */
let _config: v2.Configuration | undefined
export function getPipedriveSdkConfig(): v2.Configuration {
  if (!_config) {
    _config = new v2.Configuration({
      apiKey: getPipedriveConfig().apiKey,
    })
  }
  return _config
}
