// LAZY: replaced by the structured scope view model sourced from the Notion construction catalog.

interface TiptapNode {
  type: string
  attrs?: Record<string, unknown>
  text?: string
  content?: TiptapNode[]
}

export interface ParsedSowPhase { title: string, steps: string[] }

export interface ParsedSowSection {
  description: string | null
  specs: [label: string, value: string][]
  exclusions: string[]
  phases: ParsedSowPhase[]
  addOns: string[]
}

const DESCRIPTION = /^description:\s*/i
const AGREEMENT_NOTES = /^agreement notes$/i
const ADD_ONS = /^optional add-?ons$/i
const EXCLUSION = /not included|excluded|not responsible|unless|not specifically/i
const EXCLUSIONS_KEY = /^exclusions?$/i
// A longer value reads as a sentence and belongs in the notes, not a two-column spec row.
const MAX_SPEC_VALUE = 48

function inline(node: TiptapNode): string {
  if (node.type === 'text') {
    return node.text ?? ''
  }
  return (node.content ?? []).map(inline).join('')
}

function listItems(node: TiptapNode): string[] {
  return (node.content ?? [])
    .map(item => inline(item).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function parseDoc(json: string): TiptapNode | null {
  try {
    const parsed = JSON.parse(json) as TiptapNode
    return parsed && parsed.type === 'doc' ? parsed : null
  }
  catch {
    return null
  }
}

export function parseSowSection(contentJSON: string): ParsedSowSection | null {
  const root = parseDoc(contentJSON)
  if (!root) {
    return null
  }

  let description: string | null = null
  const groups: ParsedSowPhase[] = []
  let current: ParsedSowPhase | null = null

  for (const node of root.content ?? []) {
    const t = inline(node).replace(/\s+/g, ' ').trim()
    if (!description && (node.type === 'paragraph' || node.type === 'heading') && DESCRIPTION.test(t)) {
      description = t.replace(DESCRIPTION, '')
      continue
    }
    if (node.type === 'heading' && node.attrs?.level === 2 && t) {
      current = { title: t, steps: [] }
      groups.push(current)
      continue
    }
    if ((node.type === 'bulletList' || node.type === 'orderedList') && current) {
      current.steps.push(...listItems(node))
    }
  }

  const specs: [string, string][] = []
  const exclusions: string[] = []
  const addOns: string[] = []
  const phases: ParsedSowPhase[] = []

  for (const group of groups) {
    if (group.steps.length === 0) {
      continue
    }
    if (ADD_ONS.test(group.title)) {
      addOns.push(...group.steps)
      continue
    }
    if (!AGREEMENT_NOTES.test(group.title)) {
      phases.push(group)
      continue
    }
    const notes: string[] = []
    for (const line of group.steps) {
      const match = line.match(/^([^:]{2,40}):\s*(\S.*)$/)
      if (match && EXCLUSIONS_KEY.test(match[1].trim())) {
        exclusions.push(match[2].trim())
      }
      else if (EXCLUSION.test(line)) {
        exclusions.push(line)
      }
      else if (match && match[2].length <= MAX_SPEC_VALUE) {
        specs.push([match[1].trim(), match[2].trim()])
      }
      else {
        notes.push(line)
      }
    }
    if (notes.length > 0) {
      phases.push({ title: group.title, steps: notes })
    }
  }

  if (!description && phases.length === 0 && specs.length === 0) {
    return null
  }
  return { description, specs, exclusions, phases, addOns }
}
