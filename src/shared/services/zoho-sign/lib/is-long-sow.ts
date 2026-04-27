import { SOW_INLINE_MAX_CHARS } from '../constants'

/**
 * True when the SOW plaintext is long enough to require attachment-based
 * delivery instead of inlining into the template's sow-1/sow-2 fields.
 */
export function isLongSow(sowText: string): boolean {
  return sowText.length > SOW_INLINE_MAX_CHARS
}
