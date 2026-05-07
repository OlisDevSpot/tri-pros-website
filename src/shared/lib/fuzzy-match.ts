/**
 * Dice coefficient (Sørensen–Dice, 1945) for bigram-based string similarity.
 * Returns a value between 0 (no overlap) and 1 (identical).
 *
 * Well-suited for matching short labels where one string is a substring or
 * slight variation of the other (e.g. "roofing" → "Roofing",
 * "landscape" → "Landscape & Dryscaping").
 */
export function diceCoefficient(a: string, b: string): number {
  const first = a.toLowerCase()
  const second = b.toLowerCase()

  if (first === second) {
    return 1
  }
  if (first.length < 2 || second.length < 2) {
    return 0
  }

  const firstBigrams = new Map<string, number>()
  for (let i = 0; i < first.length - 1; i++) {
    const bigram = first.slice(i, i + 2)
    firstBigrams.set(bigram, (firstBigrams.get(bigram) ?? 0) + 1)
  }

  let intersections = 0
  for (let i = 0; i < second.length - 1; i++) {
    const bigram = second.slice(i, i + 2)
    const count = firstBigrams.get(bigram) ?? 0
    if (count > 0) {
      firstBigrams.set(bigram, count - 1)
      intersections++
    }
  }

  return (2 * intersections) / (first.length - 1 + second.length - 1)
}

export interface FuzzyMatchResult {
  match: string
  score: number
  index: number
}

/**
 * Finds the best match for `input` from a list of `candidates` using
 * Dice coefficient similarity.
 *
 * Returns null if no candidate scores above `threshold` (default 0.3).
 */
export function findBestMatch(
  input: string,
  candidates: readonly string[],
  threshold = 0.3,
): FuzzyMatchResult | null {
  if (candidates.length === 0) {
    return null
  }

  let bestScore = 0
  let bestIndex = 0

  for (let i = 0; i < candidates.length; i++) {
    const score = diceCoefficient(input, candidates[i])
    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
  }

  if (bestScore < threshold) {
    return null
  }

  return {
    match: candidates[bestIndex],
    score: bestScore,
    index: bestIndex,
  }
}
