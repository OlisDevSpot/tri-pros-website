// A leaf, like purge.ts: it imports nothing, so a DAL hook can read it without a
// DAL ever importing a service. Both media units' create hooks gate on this.

/** Images and PDFs get a derived-variant optimization pass; everything else is stored as-is. */
export function isOptimizable(mimeType: unknown): boolean {
  return typeof mimeType === 'string' && (mimeType.startsWith('image/') || mimeType === 'application/pdf')
}
