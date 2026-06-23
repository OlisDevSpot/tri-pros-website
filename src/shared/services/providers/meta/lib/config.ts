import { z } from 'zod'

import { createProviderConfig } from '@/shared/config/create-provider-config'

/**
 * Meta (Pixel + Conversions API) env fragment + runtime-config builder.
 *
 * NEXT_PUBLIC_META_PIXEL_ID is also read directly in the browser by the pixel
 * loader; it is included here so the server CAPI path and the boot banner see
 * one source of truth. META_CAPI_TOKEN is server-only and must never ship to
 * the client. META_DATASET_ID equals the Pixel ID (the CAPI events endpoint
 * target) — kept as its own var so a future standalone dataset can diverge.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 */
export const metaEnvFragment = z.object({
  NEXT_PUBLIC_META_PIXEL_ID: z.string().optional(),
  META_DATASET_ID: z.string().optional(),
  META_CAPI_TOKEN: z.string().optional(),
})

export type ParsedMetaEnv = z.infer<typeof metaEnvFragment>

export interface MetaRuntimeConfig {
  pixelId: string
  datasetId: string
  capiToken: string
}

const helpers = createProviderConfig({
  provider: 'meta',
  fragment: metaEnvFragment,
  requiredKeys: ['NEXT_PUBLIC_META_PIXEL_ID', 'META_DATASET_ID', 'META_CAPI_TOKEN'],
  toConfig: (parsed): MetaRuntimeConfig => ({
    pixelId: parsed.NEXT_PUBLIC_META_PIXEL_ID!,
    datasetId: parsed.META_DATASET_ID!,
    capiToken: parsed.META_CAPI_TOKEN!,
  }),
})

export const buildMetaConfig = helpers.build
export const getMetaConfig = helpers.get
export const isMetaConfigured = helpers.isConfigured
export const metaConfigMeta = helpers.configMeta
