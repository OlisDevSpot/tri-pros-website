export function formatTenure(startDate: string | null | undefined): string | null {
  if (!startDate) {
    return null
  }

  const start = new Date(startDate)
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`
  }

  const diffMonths = Math.floor(diffDays / 30)

  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`
  }

  const years = Math.floor(diffMonths / 12)
  const remainingMonths = diffMonths % 12

  if (remainingMonths === 0) {
    return `${years} year${years !== 1 ? 's' : ''}`
  }

  return `${years} year${years !== 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`
}
