// Part pins share one pin registry with the home's anchors and readings, so their ids carry a prefix of their own.
const PREFIX = 'part:'

export function partPinId(partId: string): string {
  return `${PREFIX}${partId}`
}

export function partFromPinId(id: string): string | null {
  return id.startsWith(PREFIX) ? id.slice(PREFIX.length) : null
}
