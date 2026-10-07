export interface MergeToken<TVars> {
  /** The token as typed in a body, without braces: "first_name". */
  token: string
  label: string
  /** Stands in for the value in previews and length counts. */
  sample: string
  resolve: (vars: TVars) => string
}

const MERGE_TOKEN_PATTERN = /\{\{\s*(\w+)\s*\}\}/g

/** An unknown token stays as typed, so a typo shows in the text instead of vanishing. */
export function renderMergeTemplate<TVars>(body: string, tokens: readonly MergeToken<TVars>[], vars: TVars): string {
  return body.replace(MERGE_TOKEN_PATTERN, (match, name: string) => {
    const token = tokens.find(candidate => candidate.token === name)
    return token ? token.resolve(vars) : match
  })
}

export function renderMergeSample<TVars>(body: string, tokens: readonly MergeToken<TVars>[]): string {
  return body.replace(MERGE_TOKEN_PATTERN, (match, name: string) => {
    const token = tokens.find(candidate => candidate.token === name)
    return token ? token.sample : match
  })
}

/** Token names in a body, in order, once each. */
export function listMergeTokens(body: string): string[] {
  return [...new Set([...body.matchAll(MERGE_TOKEN_PATTERN)].map(match => match[1]))]
}
