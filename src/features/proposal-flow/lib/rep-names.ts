export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

export function joinFirstNames(reps: { name: string }[]): string {
  return reps.map(rep => firstName(rep.name)).filter(Boolean).join(' and ')
}

/** Copy that names the reps; with none (no meeting, or only the system user) it names the team instead. */
export function repsPhrase(reps: { name: string }[], { sentenceStart = false }: { sentenceStart?: boolean } = {}): string {
  return joinFirstNames(reps) || (sentenceStart ? 'Our team' : 'our team')
}

// "Our team" (no reps) takes the singular, like one rep.
export function repsVerb(reps: { name: string }[], singular: string, plural: string): string {
  return reps.length > 1 ? plural : singular
}
