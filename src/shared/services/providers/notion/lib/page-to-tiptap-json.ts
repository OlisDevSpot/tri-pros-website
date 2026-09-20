import type { NotionBlock } from '@notion-utils/html'
import { notionClient } from '../client'
import { notionBlocksToTiptapDoc } from './blocks-to-tiptap-json'

/**
 * blocks.children.list caps page_size at 100 and returns has_more + next_cursor.
 * Both read sites ignored them, truncating long SOW documents and long lists.
 * see ../DOCS.md#reads-paginate
 */
async function listAllBlockChildren(blockId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = []
  let cursor: string | undefined

  do {
    const response = await notionClient.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      start_cursor: cursor,
    }) as { results: NotionBlock[], has_more: boolean, next_cursor: string | null }

    blocks.push(...response.results)
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined
  } while (cursor)

  return blocks
}

async function resolveChildren(blocks: NotionBlock[]): Promise<NotionBlock[]> {
  return Promise.all(
    blocks.map(async (block) => {
      if (!block.has_children)
        return block

      const children = await resolveChildren(await listAllBlockChildren(block.id))

      return { ...block, children }
    }),
  )
}

export async function pageToTiptapJson(pageId: string) {
  const blocks = await resolveChildren(await listAllBlockChildren(pageId))
  const tiptapJson = notionBlocksToTiptapDoc(blocks)

  return JSON.stringify(tiptapJson)
}
