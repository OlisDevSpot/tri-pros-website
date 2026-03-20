export const R2_BUCKETS = {
  portfolioProjects: 'tpr-portfolio-projects',
  companyDocs: 'tpr-company-docs',
  telemarketingRecordings: 'tpr-telemarketing-recordings',
} as const

export type R2BucketName = (typeof R2_BUCKETS)[keyof typeof R2_BUCKETS]

// Partial — not all buckets have a public domain (telemarketingRecordings is private)
export const R2_PUBLIC_DOMAINS: Partial<Record<R2BucketName, string>> = {
  'tpr-portfolio-projects': 'https://pub-06be62a0a47b42cbb944ba281f4df793.r2.dev',
  'tpr-company-docs': 'https://pub-e9f58acecb564416a1d1880ba1a88a7f.r2.dev',
}
