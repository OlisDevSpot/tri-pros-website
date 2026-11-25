export function digitsToNumber(raw: string) {
  return Number(raw.replace(/\D/g, ''))
}
