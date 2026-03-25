import type { SOW } from '@/shared/entities/proposals/types'

interface TiptapMark { type: string, attrs?: Record<string, any> }

interface TiptapNode {
  type: string
  attrs?: Record<string, any>
  text?: string
  marks?: TiptapMark[]
  content?: TiptapNode[]
}

/**
 * Convert an array of SOW entries (each with a `contentJSON` string
 * containing a Tiptap doc) into readable plaintext.
 */
export function sowToPlaintext(sow: SOW[]): string {
  const chunks: string[] = []

  for (const item of sow) {
    const doc = safeParseDoc(item.contentJSON)
    if (!doc) {
      continue
    }

    const text = tiptapToText(doc)
    if (text.trim()) {
      chunks.push(text.trim())
    }
  }

  return chunks.join('\n\n')
}

/** ---- Parsing ---- */

function safeParseDoc(json: string): TiptapNode | null {
  try {
    const parsed = JSON.parse(json) as TiptapNode
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    if (parsed.type !== 'doc') {
      return null
    }
    return parsed
  }
  catch {
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
      if (t.length) {
        out.push(t)
      }
      out.push('\n')
      return
    }

    case 'horizontalRule': {
      out.push('\n\n')
      return
    }

    case 'blockquote': {
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
      out.push('\u2022 ')
      forEachChild(node, child => walk(child, out))
      if (!out.join('').endsWith('\n')) {
        out.push('\n')
      }
      return
    }

    case 'text': {
      out.push(node.text ?? '')
      return
    }

    default: {
      forEachChild(node, child => walk(child, out))
    }
  }
}

function forEachChild(node: TiptapNode, fn: (child: TiptapNode) => void) {
  if (!Array.isArray(node.content)) {
    return
  }
  for (const c of node.content) fn(c)
}

/**
 * Extracts only inline text from a node's descendants (text nodes),
 * preserving order, ignoring structure.
 */
function extractInlineText(node: TiptapNode): string {
  const parts: string[] = []

  const recurse = (n: TiptapNode) => {
    if (n.type === 'text') {
      parts.push(n.text ?? '')
      return
    }
    if (Array.isArray(n.content)) {
      n.content.forEach(recurse)
    }
  }

  recurse(node)
  return parts.join('')
}

/** Normalize whitespace/newlines so output is readable. */
function normalize(s: string): string {
  return (
    s
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}
