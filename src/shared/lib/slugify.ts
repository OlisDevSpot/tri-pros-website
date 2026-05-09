interface SlugifyOptions {
  maxLen?: number
}

export function slugify(input: string, options: SlugifyOptions = {}): string {
  const { maxLen } = options
  const result = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return maxLen ? result.slice(0, maxLen) : result
}
