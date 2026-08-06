/**
 * Public, isomorphic R2 metadata — bucket registry, public-domain map, and
 * the `R2BucketName` type. No SDK imports, so this entrypoint is safe for
 * client components (building public image URLs) AND the server `client.ts`.
 *
 * Second public surface of the r2 provider alongside `client.ts`; mirrors the
 * `types.ts` of the reference-clean providers (cloudtalk, twilio). External
 * consumers import bucket constants/types from here — never from loose files.
 */

export const R2_BUCKETS = {
  media: 'tpr-media',
  companyDocs: 'tpr-company-docs',
  homeownerFiles: 'tpr-homeowner-files',
} as const

export type R2BucketName = (typeof R2_BUCKETS)[keyof typeof R2_BUCKETS]

// Not all buckets have a public domain. `tpr-media` is the canonical PUBLIC
// media bucket (project + proposal assets) served via the production CDN.
// `homeownerFiles` stays PRIVATE (call recordings) → no public domain.
// pub-*.r2.dev is Cloudflare's rate-limited dev endpoint and must not carry
// production traffic (#160).
export const R2_PUBLIC_DOMAINS: Partial<Record<R2BucketName, string>> = {
  'tpr-media': 'https://media.triprosremodeling.com',
  'tpr-company-docs': 'https://pub-e9f58acecb564416a1d1880ba1a88a7f.r2.dev',
}
