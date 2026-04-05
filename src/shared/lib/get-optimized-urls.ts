import { R2_PUBLIC_DOMAINS } from '@/shared/services/r2/buckets'

const DEFAULT_R2_DOMAIN = R2_PUBLIC_DOMAINS['tpr-portfolio-projects'] ?? ''

interface MediaFileInput {
  url: string
  pathKey: string
  bucket: string
  optimizationStatus: string
}

export function getOptimizedSrc(file: MediaFileInput): string {
  if (file.optimizationStatus !== 'optimized') {
    return file.url
  }
  const base = file.pathKey.replace(/\.[^.]+$/, '')
  const domain = R2_PUBLIC_DOMAINS[file.bucket as keyof typeof R2_PUBLIC_DOMAINS] ?? DEFAULT_R2_DOMAIN
  return `${domain}/${base}-lg.webp`
}

export function getOptimizedSrcSet(file: MediaFileInput): string | undefined {
  if (file.optimizationStatus !== 'optimized') {
    return undefined
  }
  const base = file.pathKey.replace(/\.[^.]+$/, '')
  const domain = R2_PUBLIC_DOMAINS[file.bucket as keyof typeof R2_PUBLIC_DOMAINS] ?? DEFAULT_R2_DOMAIN
  return `${domain}/${base}-sm.webp 640w, ${domain}/${base}-md.webp 1280w, ${domain}/${base}-lg.webp 1920w`
}
