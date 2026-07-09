export function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 200)
}
