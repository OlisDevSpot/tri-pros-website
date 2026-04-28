import { SOW_FIELD_MAX_CHARS } from '../constants'

const MIN_FILL_RATIO = 0.5

/**
 * Packs SOW plaintext into the sow-1/sow-2 Zoho template fields.
 *
 * Fills sow-1 up to SOW_FIELD_MAX_CHARS, preferring clean boundaries
 * (paragraph → line → sentence → word). Then fills sow-2 from what
 * remains. On the short path (guaranteed by caller), overflow must be 0;
 * if not, that indicates a threshold-routing bug and the caller is
 * responsible for error handling.
 */
export function packSowText(fullText: string): {
  sow1: string
  sow2: string
  overflow: number
} {
  const trimmed = fullText.trim()
  if (trimmed.length === 0) {
    return { sow1: '', sow2: '', overflow: 0 }
  }

  const split1 = findSplit(trimmed, SOW_FIELD_MAX_CHARS)
  const sow1 = trimmed.slice(0, split1).trim()
  const remaining = trimmed.slice(split1).trimStart()

  if (remaining.length === 0) {
    return { sow1, sow2: '', overflow: 0 }
  }

  const split2 = findSplit(remaining, SOW_FIELD_MAX_CHARS)
  const sow2 = remaining.slice(0, split2).trim()
  const overflow = remaining.length - split2

  return { sow1, sow2, overflow }
}

function findSplit(text: string, maxLen: number): number {
  if (text.length <= maxLen) {
    return text.length
  }
  const window = text.slice(0, maxLen)
  for (const sep of ['\n\n', '\n', '. ', ' ']) {
    const idx = window.lastIndexOf(sep)
    if (idx >= maxLen * MIN_FILL_RATIO) {
      return idx + sep.length
    }
  }
  return maxLen
}
