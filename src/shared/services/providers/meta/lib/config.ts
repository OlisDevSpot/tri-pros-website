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
 * META_TEST_EVENT_CODE is an OPTIONAL, staging-only QA toggle: when set, every
 * CAPI event carries `test_event_code`, routing it to Events Manager → Test
 * Events ONLY (Meta excludes test events from optimization + reporting). It is
 * therefore NOT a required key — `isMetaConfigured()` ignores it — and server-env
 * HARD-FAILS boot if it is ever set with NODE_ENV=production, so a stray code
 * cannot silently divert real prod Leads out of optimization.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 */
export const metaEnvFragment = z.object({
  NEXT_PUBLIC_META_PIXEL_ID: z.string().optional(),
  META_DATASET_ID: z.string().optional(),
  META_CAPI_TOKEN: z.string().optional(),
  META_TEST_EVENT_CODE: z.string().optional(),
})

export type ParsedMetaEnv = z.infer<typeof metaEnvFragment>

export interface MetaRuntimeConfig {
  pixelId: string
  datasetId: string
  capiToken: string
  /** Present only in staging/QA — routes CAPI events to Test Events. */
  testEventCode?: string
}

const helpers = createProviderConfig({
  provider: 'meta',
  fragment: metaEnvFragment,
  requiredKeys: ['NEXT_PUBLIC_META_PIXEL_ID', 'META_DATASET_ID', 'META_CAPI_TOKEN'],
  toConfig: (parsed): MetaRuntimeConfig => ({
    pixelId: parsed.NEXT_PUBLIC_META_PIXEL_ID!,
    datasetId: parsed.META_DATASET_ID!,
    capiToken: parsed.META_CAPI_TOKEN!,
    testEventCode: parsed.META_TEST_EVENT_CODE,
  }),
})

export const buildMetaConfig = helpers.build
export const getMetaConfig = helpers.get
export const isMetaConfigured = helpers.isConfigured
export const metaConfigMeta = helpers.configMeta
