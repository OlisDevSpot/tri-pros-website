// v1 approximation: assume GSM-7 (160 chars / segment, 153 for multi-part).
// {{tokens}} are counted at their literal length — see plan §12 q1 for the
// known imprecision (a token resolving to UCS-2 chars would flip the limit).

export function countSmsSegments(body: string): { chars: number, segments: number } {
  const chars = body.length
  if (chars === 0) {
    return { chars: 0, segments: 0 }
  }
  const segments = chars <= 160 ? 1 : Math.ceil(chars / 153)
  return { chars, segments }
}
