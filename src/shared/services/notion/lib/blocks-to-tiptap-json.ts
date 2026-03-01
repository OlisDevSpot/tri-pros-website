interface NotionRichText {
  type: 'text' | 'mention' | 'equation'
  text?: { content: string, link: { url: string } | null }
  plain_text: string
  href: string | null
  annotations: {
    bold: boolean
    italic: boolean
    strikethrough: boolean
    underline: boolean
    code: boolean
    color: string // ignore for now, or map to a mark later
  }
}

interface NotionBlock {
  id: string
  type: string
  has_children: boolean
  [key: string]: any // holds e.g. block.paragraph, block.heading_2, etc
}

interface TiptapNode {
  type: string
  attrs?: Record<string, any>
  content?: TiptapNode[]
  text?: string
  marks?: Array<{ type: string, attrs?: Record<string, any> }>
}

type BlockHandlerResult
  = | { kind: 'node', node: TiptapNode }
    | { kind: 'listItem', listType: 'bulletList' | 'orderedList', item: TiptapNode }
    | { kind: 'skip' }

type BlockHandler = (block: NotionBlock) => BlockHandlerResult

export function notionBlocksToTiptapDoc(blocks: NotionBlock[]): TiptapNode {
  const handlers: BlockHandler[] = [
    handleDivider,
    handleHeading,
    handleBulletedListItem,
    handleNumberedListItem,
    handleParagraph,
    handleToDo, // optional: if you start using checkboxes
  ]

  const content: TiptapNode[] = []

  // list accumulation
  let currentListType: 'bulletList' | 'orderedList' | null = null
  let currentListItems: TiptapNode[] = []

  const flushList = () => {
    if (!currentListType || currentListItems.length === 0)
      return
    content.push({ type: currentListType, content: currentListItems })
    currentListType = null
    currentListItems = []
  }

  for (const block of blocks) {
    const res = runHandlers(handlers, block)

    if (res.kind === 'skip')
      continue

    if (res.kind === 'listItem') {
      if (currentListType && currentListType !== res.listType)
        flushList()
      currentListType = res.listType
      currentListItems.push(res.item)
      continue
    }

    // normal node
    flushList()
    content.push(res.node)
  }

  flushList()

  return { type: 'doc', content }
}

function runHandlers(handlers: BlockHandler[], block: NotionBlock): BlockHandlerResult {
  for (const h of handlers) {
    const res = h(block)
    if (res.kind !== 'skip')
      return res
  }
  // Unknown block types get skipped by default (or you can turn into paragraph text)
  return { kind: 'skip' }
}

/** ---------- Block handlers ---------- */

function handleDivider(block: NotionBlock): BlockHandlerResult {
  if (block.type !== 'divider')
    return { kind: 'skip' }
  return { kind: 'node', node: { type: 'horizontalRule' } }
}

function handleHeading(block: NotionBlock): BlockHandlerResult {
  const m = block.type.match(/^heading_([123])$/)
  if (!m)
    return { kind: 'skip' }

  const level = Number(m[1])
  const rt: NotionRichText[] = block[block.type]?.rich_text ?? []
  return {
    kind: 'node',
    node: {
      type: 'heading',
      attrs: { level },
      content: notionRichTextToTiptap(rt),
    },
  }
}

function handleParagraph(block: NotionBlock): BlockHandlerResult {
  if (block.type !== 'paragraph')
    return { kind: 'skip' }
  const rt: NotionRichText[] = block.paragraph?.rich_text ?? []
  return { kind: 'node', node: { type: 'paragraph', content: notionRichTextToTiptap(rt) } }
}

function handleBulletedListItem(block: NotionBlock): BlockHandlerResult {
  if (block.type !== 'bulleted_list_item')
    return { kind: 'skip' }
  const rt: NotionRichText[] = block.bulleted_list_item?.rich_text ?? []

  const item: TiptapNode = {
    type: 'listItem',
    content: [
      {
        type: 'paragraph',
        content: notionRichTextToTiptap(rt),
      },
    ],
  }

  return { kind: 'listItem', listType: 'bulletList', item }
}

function handleNumberedListItem(block: NotionBlock): BlockHandlerResult {
  if (block.type !== 'numbered_list_item')
    return { kind: 'skip' }
  const rt: NotionRichText[] = block.numbered_list_item?.rich_text ?? []

  const item: TiptapNode = {
    type: 'listItem',
    content: [
      {
        type: 'paragraph',
        content: notionRichTextToTiptap(rt),
      },
    ],
  }

  return { kind: 'listItem', listType: 'orderedList', item }
}

/**
 * Optional: Notion "to_do" blocks.
 * If you use Tiptap's taskList/taskItem extensions, map to those types.
 * Otherwise, you can treat them as bullet items prefixed with "[ ]".
 */
function handleToDo(block: NotionBlock): BlockHandlerResult {
  if (block.type !== 'to_do')
    return { kind: 'skip' }

  const rt: NotionRichText[] = block.to_do?.rich_text ?? []
  const checked: boolean = !!block.to_do?.checked

  // If you have taskList/taskItem in your schema:
  // return { kind: "listItem", listType: "taskList" as any, ... } // you'd expand listType union

  // Minimal fallback: represent as a bullet item with literal checkbox text.
  const prefix = checked ? '[x] ' : '[ ] '
  const content = notionRichTextToTiptap(rt)
  if (content.length > 0 && content[0].type === 'text') {
    content[0] = { ...content[0], text: prefix + (content[0].text ?? '') }
  }
  else {
    content.unshift({ type: 'text', text: prefix })
  }

  const item: TiptapNode = {
    type: 'listItem',
    content: [{ type: 'paragraph', content }],
  }

  return { kind: 'listItem', listType: 'bulletList', item }
}

/** ---------- Rich text conversion ---------- */

function notionRichTextToTiptap(richText: NotionRichText[]): TiptapNode[] {
  const out: TiptapNode[] = []

  for (const r of richText) {
    // For now, treat anything as plain text via plain_text. (You can add mention/equation handlers later.)
    const text = r.plain_text ?? ''
    if (text.length === 0)
      continue

    const marks = notionAnnotationsToMarks(r)
    const node: TiptapNode = { type: 'text', text }
    if (marks.length)
      node.marks = marks

    out.push(node)
  }

  return out
}

function notionAnnotationsToMarks(r: NotionRichText): Array<{ type: string, attrs?: Record<string, any> }> {
  const marks: Array<{ type: string, attrs?: Record<string, any> }> = []
  const a = r.annotations

  if (a?.bold)
    marks.push({ type: 'bold' })
  if (a?.italic)
    marks.push({ type: 'italic' })
  if (a?.strikethrough)
    marks.push({ type: 'strike' })
  if (a?.underline)
    marks.push({ type: 'underline' }) // requires underline extension
  if (a?.code)
    marks.push({ type: 'code' })

  // Notion links can appear as r.text.link or r.href
  const url = r.text?.link?.url ?? r.href ?? null
  if (url)
    marks.push({ type: 'link', attrs: { href: url } })

  return marks
}
