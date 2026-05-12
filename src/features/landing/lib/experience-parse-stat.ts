export interface ParsedStat {
  prefix: string
  numeric: number | null
  suffix: string
}

export function parseStat(input: string): ParsedStat {
  const match = input.match(/^(\D*)(\d+(?:\.\d+)?)(\D*)$/)
  if (!match) {
    return { prefix: input, numeric: null, suffix: '' }
  }
  return {
    prefix: match[1] ?? '',
    numeric: Number(match[2]),
    suffix: match[3] ?? '',
  }
}
