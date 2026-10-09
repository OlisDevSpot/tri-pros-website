export interface MergeToken<TVars> {
  /** The token as typed in a body, without braces: "first_name". */
  token: string
  label: string
  /** Stands in for the value in previews and length counts. */
  sample: string
  resolve: (vars: TVars) => string
}

const MERGE_TOKEN_PATTERN = /\{\{\s*(\w+)\s*\}\}/g
// {{#name}}...{{/name}} keeps its text when name has a value, {{^name}}...{{/name}} when it has none.
const SECTION_PATTERN = /\{\{\s*([#^])\s*(\w+)\s*\}\}([\s\S]*?)\{\{\s*\/\s*\2\s*\}\}/g
const ANY_TOKEN_PATTERN = /\{\{\s*(?:[#^]\s*)?(\w+)\s*\}\}/g
const TAG_PATTERN = /\{\{\s*([#^/])\s*(\w+)\s*\}\}/g

function render<TVars>(body: string, tokens: readonly MergeToken<TVars>[], valueOf: (token: MergeToken<TVars>) => string): string {
  const withSections = body.replace(SECTION_PATTERN, (match, mark: string, name: string, inner: string) => {
    const token = tokens.find(candidate => candidate.token === name)
    if (!token) {
      return match
    }
    const hasValue = valueOf(token).trim().length > 0
    return hasValue === (mark === '#') ? inner : ''
  })
  return withSections.replace(MERGE_TOKEN_PATTERN, (match, name: string) => {
    const token = tokens.find(candidate => candidate.token === name)
    return token ? valueOf(token) : match
  })
}

/** An unknown token stays as typed, so a typo shows in the text instead of vanishing. */
export function renderMergeTemplate<TVars>(body: string, tokens: readonly MergeToken<TVars>[], vars: TVars): string {
  return render(body, tokens, token => token.resolve(vars))
}

export function renderMergeSample<TVars>(body: string, tokens: readonly MergeToken<TVars>[]): string {
  return render(body, tokens, token => token.sample)
}

/** Token names in a body, section tokens included, in order, once each. */
export function listMergeTokens(body: string): string[] {
  return [...new Set([...body.matchAll(ANY_TOKEN_PATTERN)].map(match => match[1]))]
}

/** Sections that cannot render: an opener with no closer, a closer with no opener, or one section inside another. */
export function findSectionErrors(body: string): string[] {
  const errors: string[] = []
  let open: string | null = null
  let nested: string | null = null
  for (const [, mark, name] of body.matchAll(TAG_PATTERN)) {
    if (mark !== '/') {
      if (open) {
        errors.push(`{{${mark}${name}}} sits inside the {{${open}}} section; sections cannot be nested.`)
        nested = name
      }
      else {
        open = `${mark}${name}`
      }
    }
    else if (nested === name) {
      nested = null
    }
    else if (open?.slice(1) === name) {
      open = null
    }
    else {
      errors.push(`{{/${name}}} closes a section that was never opened.`)
    }
  }
  if (open) {
    errors.push(`The {{${open}}} section is never closed with {{/${open.slice(1)}}}.`)
  }
  return errors
}
