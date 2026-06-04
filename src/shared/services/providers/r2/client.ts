import { S3Client } from '@aws-sdk/client-s3'

import { lazyProxy } from '@/shared/config/lazy-proxy'

import { getR2Config } from './lib/config'

/**
 * Cloudflare R2 S3-compatible client. Lazy-constructed via `lazyProxy` so
 * missing R2 credentials don't crash app boot — first call to any
 * `r2Client.send(new SomeCommand(...))` throws `NotConfiguredError` if any
 * of R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY is unset.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 */
export const r2Client = lazyProxy(() => {
  const config = getR2Config()
  return new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    forcePathStyle: false,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
})
