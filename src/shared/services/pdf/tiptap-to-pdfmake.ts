interface TiptapMark { type: string, attrs?: Record<string, unknown> }

export interface TiptapNode {
  type: string
  attrs?: Record<string, unknown>
  text?: string
  marks?: TiptapMark[]
  content?: TiptapNode[]
}

type PdfMakeContent = unknown

/**
 * Convert a Tiptap doc node into a pdfmake content array. Mirrors the
 * structure of `src/shared/lib/tiptap-to-text.ts` but emits structured
 * pdfmake content instead of plaintext.
 */
export function tiptapToPdfmake(doc: TiptapNode): PdfMakeContent[] {
  if (doc.type !== 'doc' || !Array.isArray(doc.content)) {
    return []
  }
  const out: PdfMakeContent[] = []
  for (const child of doc.content) {
    const rendered = renderBlock(child)
    if (rendered !== null) {
      out.push(rendered)
    }
  }
  return out
}

function renderBlock(node: TiptapNode): PdfMakeContent | null {
  switch (node.type) {
    case 'paragraph': {
      const runs = renderInline(node.content ?? [])
      if (runs.length === 0) {
        return { text: '', margin: [0, 0, 0, 4] }
      }
      const text = runs.length === 1 && isPlainTextRun(runs[0]) ? runs[0].text : runs
      return { text, margin: [0, 0, 0, 4] }
    }
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 2
      const style = `h${Math.min(Math.max(level, 1), 3)}`
      return { text: extractPlaintext(node), style, margin: [0, 8, 0, 4] }
    }
    case 'bulletList': {
      return { ul: (node.content ?? []).map(renderListItem) }
    }
    case 'orderedList': {
      return { ol: (node.content ?? []).map(renderListItem) }
    }
    case 'blockquote': {
      return { text: extractPlaintext(node), style: 'quote', margin: [8, 4, 0, 4] }
    }
    case 'horizontalRule': {
      return {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }],
        margin: [0, 4, 0, 4],
      }
    }
    default: {
      if (Array.isArray(node.content)) {
        const children = node.content.map(renderBlock).filter((x): x is PdfMakeContent => x !== null)
        if (children.length === 1)
          return children[0]
        if (children.length > 1)
          return { stack: children }
      }
      return null
    }
  }
}

function renderListItem(item: TiptapNode): PdfMakeContent {
  if (!Array.isArray(item.content) || item.content.length === 0) {
    return ''
  }
  const children = item.content.map(renderBlock).filter((x): x is PdfMakeContent => x !== null)
  if (children.length === 0)
    return ''
  if (children.length === 1)
    return children[0]
  return { stack: children }
}

interface TextRun { text: string, bold?: boolean, italics?: boolean, decoration?: string }

function renderInline(nodes: TiptapNode[]): TextRun[] {
  const runs: TextRun[] = []
  for (const n of nodes) {
    if (n.type === 'text') {
      const run: TextRun = { text: n.text ?? '' }
      for (const mark of n.marks ?? []) {
        if (mark.type === 'bold')
          run.bold = true
        if (mark.type === 'italic')
          run.italics = true
        if (mark.type === 'underline')
          run.decoration = 'underline'
      }
      runs.push(run)
    }
    else if (Array.isArray(n.content)) {
      runs.push(...renderInline(n.content))
    }
  }
  return runs
}

function isPlainTextRun(run: TextRun): boolean {
  return run.bold === undefined && run.italics === undefined && run.decoration === undefined
}

function extractPlaintext(node: TiptapNode): string {
  if (node.type === 'text')
    return node.text ?? ''
  if (!Array.isArray(node.content))
    return ''
  return node.content.map(extractPlaintext).join('')
}
