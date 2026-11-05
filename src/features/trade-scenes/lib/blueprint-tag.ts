export function isBlueprintOmitted(userData: Record<string, unknown>): boolean {
  return userData.blueprintOmit === true
}
