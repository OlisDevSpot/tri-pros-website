/** Homeowner copy names a person by nickname, else first name; null when there is nobody to name. */
export function displayFirstName(person: { name: string, nickname: string | null } | null): string | null {
  if (!person) {
    return null
  }
  return person.nickname?.trim() || person.name.trim().split(/\s+/)[0] || null
}
