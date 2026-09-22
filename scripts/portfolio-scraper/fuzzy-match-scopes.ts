import type { MatchedScope } from './types'
import type { Scope } from '@/shared/modules/construction/core/schemas'

export function fuzzyMatchScopes(
  allScopes: Scope[],
  description: string,
): MatchedScope[] {
  const terms = description
    .toLowerCase()
    .split(/[,&+/]/)
    .map(t => t.trim())
    .filter(Boolean)

  const matched = new Map<string, MatchedScope>()

  for (const scope of allScopes) {
    const scopeLower = scope.name.toLowerCase()
    for (const term of terms) {
      if (
        scopeLower.includes(term)
        || term.includes(scopeLower)
        || levenshteinSimilar(scopeLower, term, 0.6)
      ) {
        matched.set(scope.id, {
          id: scope.id,
          name: scope.name,
          kind: scope.kind,
        })
      }
    }
  }

  return Array.from(matched.values())
}

function levenshteinSimilar(a: string, b: string, threshold: number): boolean {
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a

  if (longer.length === 0)
    return true

  const distance = levenshteinDistance(longer, shorter)
  const similarity = (longer.length - distance) / longer.length

  return similarity >= threshold
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      }
      else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        )
      }
    }
  }

  return matrix[b.length][a.length]
}
