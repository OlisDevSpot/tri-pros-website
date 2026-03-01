/* eslint-disable unused-imports/no-unused-vars */
import type { Proposal } from '@/shared/db/schema/proposals'
import env from '@/shared/config/server-env'

const TEMPLATE_IDS = {
  base: env.NODE_ENV === 'production' ? 'b76894d0-c2bf-4b7a-97bb-b69653314f1d' : '6a8da4cb-db4d-44b7-a956-82bc4f0590e9',
  senior: env.NODE_ENV === 'production' ? '540e4a68-ceeb-4d9b-ac84-88b50761ea6e' : '73cf3127-327d-4cdd-949b-ea8d670d2dd6',
}

// function stripHtml(html: string): string {
//   return html.replace(/<[^>]*>/g, '')
// }

interface TiptapMark { type: string, attrs?: Record<string, any> }

interface TiptapNode {
  type: string
  attrs?: Record<string, any>
  text?: string
  marks?: TiptapMark[]
  content?: TiptapNode[]
}

/**
 * Extract readable plaintext from an array of `{ contentJSON: string }`
 * where `contentJSON` is a stringified Tiptap doc.
 */
export function extractSowText(proposal: Proposal): string {
  const chunks: string[] = []

  for (const item of proposal.projectJSON.data.sow ?? []) {
    const doc = safeParseDoc(item.contentJSON)
    if (!doc)
      continue

    const text = tiptapToText(doc)
    if (text.trim())
      chunks.push(text.trim())
  }

  // Separate each SOW “section/doc” with blank line.
  return chunks.join('\n\n')
}

/** ---- Parsing ---- */

function safeParseDoc(json: string): TiptapNode | null {
  try {
    const parsed = JSON.parse(json) as TiptapNode
    if (!parsed || typeof parsed !== 'object')
      return null
    if (parsed.type !== 'doc')
      return null
    return parsed
  }
  catch {
    // Don’t blow up your tRPC procedure just because one entry is malformed.
    return null
  }
}

/** ---- Conversion (recursive) ---- */

function tiptapToText(node: TiptapNode): string {
  const out: string[] = []
  walk(node, out)
  return normalize(out.join(''))
}

function walk(node: TiptapNode, out: string[]) {
  switch (node.type) {
    case 'doc': {
      forEachChild(node, child => walk(child, out))
      return
    }

    case 'heading': {
      out.push('\n')
      out.push(extractInlineText(node))
      out.push('\n\n')
      return
    }

    case 'paragraph': {
      const t = extractInlineText(node)
      // Keep empty paragraphs as a blank line if you want,
      // but don’t spam newlines for completely missing content.
      if (t.length)
        out.push(t)
      out.push('\n')
      return
    }

    case 'horizontalRule': {
      // For plaintext, treat as section break
      out.push('\n\n')
      return
    }

    case 'blockquote': {
      // Flatten: prepend a marker or just treat like content
      // Here: keep it simple; add a newline before/after
      out.push('\n')
      forEachChild(node, child => walk(child, out))
      out.push('\n')
      return
    }

    case 'bulletList': {
      out.push('\n')
      forEachChild(node, child => walk(child, out))
      out.push('\n')
      return
    }

    case 'orderedList': {
      out.push('\n')
      let i = 1
      forEachChild(node, (child) => {
        walk({ ...child, attrs: { ...(child.attrs ?? {}), __index: i++ } }, out)
      })
      out.push('\n')
      return
    }

    case 'listItem': {
      // listItem usually contains a paragraph (and possibly nested lists)
      const isOrdered = false // we handle numbering via orderedList wrapper, optional
      out.push('• ')
      forEachChild(node, child => walk(child, out))
      // list items already end with paragraph newlines, but ensure at least one
      if (!out.join('').endsWith('\n'))
        out.push('\n')
      return
    }

    case 'text': {
      out.push(node.text ?? '')
      return
    }

    default: {
      // Future-proof: unknown nodes just recurse into children if present
      forEachChild(node, child => walk(child, out))
    }
  }
}

function forEachChild(node: TiptapNode, fn: (child: TiptapNode) => void) {
  if (!Array.isArray(node.content))
    return
  for (const c of node.content) fn(c)
}

/**
 * Extracts only inline text from a node’s descendants (text nodes),
 * preserving order, ignoring structure.
 */
function extractInlineText(node: TiptapNode): string {
  const parts: string[] = []

  const recurse = (n: TiptapNode) => {
    if (n.type === 'text') {
      parts.push(n.text ?? '')
      return
    }
    if (Array.isArray(n.content))
      n.content.forEach(recurse)
  }

  recurse(node)
  return parts.join('')
}

/** Normalize whitespace/newlines a bit so output is readable. */
function normalize(s: string): string {
  return (
    s
      .replace(/[ \t]+\n/g, '\n') // trailing spaces before newline
      .replace(/\n{3,}/g, '\n\n') // collapse huge blank gaps
      .trim()
  )
}

export function buildEnvelopeBody(proposal: Proposal, status: 'created' | 'sent') {
  const { homeownerJSON, projectJSON, fundingJSON } = proposal
  const { data: homeowner } = homeownerJSON
  const { data: project } = projectJSON
  const { data: funding } = fundingJSON

  const isSenior = (homeowner.age ?? 0) >= 62
  const templateId = isSenior ? TEMPLATE_IDS.senior : TEMPLATE_IDS.base

  const sowText = extractSowText(proposal)
  const sow1 = sowText.slice(0, 2000)
  const sow2 = sowText.slice(2000, 6000)

  const validThroughTimeframe = Number(project.validThroughTimeframe.replace(/\D/g, ''))
  const startDate = new Date()
  const completionDate = new Date()

  const daysToAdd = isSenior ? 5 : 3

  startDate.setDate(startDate.getDate() + daysToAdd)
  completionDate.setDate(startDate.getDate() + validThroughTimeframe)

  return {
    templateId,
    status,
    templateRoles: [
      {
        roleName: 'Contractor',
        tabs: {
          textTabs: [
            { tabLabel: 'start-date', value: startDate.toLocaleDateString() },
            { tabLabel: 'completion-date', value: completionDate.toLocaleDateString() },
            { tabLabel: 'sow-1', value: sow1 },
            { tabLabel: 'sow-2', value: sow2 },
          ],
          numericalTabs: [
            { tabLabel: 'tcp', numericalValue: String(funding.finalTcp) },
            { tabLabel: 'deposit', numericalValue: String(funding.depositAmount) },
          ],
        },
      },
      {
        roleName: 'Homeowner',
        name: homeowner.name,
        email: homeowner.email,
        tabs: {
          textTabs: [
            { tabLabel: 'ho-address', value: project.address },
            { tabLabel: 'ho-city-state-zip', value: `${project.city}, CA ${project.zip}` },
            { tabLabel: 'ho-phone', value: homeowner.phoneNum },
            { tabLabel: 'ho-age', value: String(homeowner.age ?? '-') },
          ],
        },
      },
    ],
  }
}
