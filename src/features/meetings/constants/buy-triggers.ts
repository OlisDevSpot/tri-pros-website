export function getDaysLeftInMonth(): number {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return lastDay - now.getDate()
}

export function getCurrentMonth(): string {
  return new Date().toLocaleString('en-US', { month: 'long' })
}

export function getMonthEnd(): string {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return lastDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

export function getInstallSlotsLeft(): number {
  // Derived from remaining work days in the month — keeps the number feeling real
  return Math.min(getDaysLeftInMonth(), 4)
}
