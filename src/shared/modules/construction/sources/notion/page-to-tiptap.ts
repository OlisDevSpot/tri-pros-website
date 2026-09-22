import type { NotionBlock } from '@notion-utils/html'
import { notionClient } from '@/shared/services/providers/notion/client'
import { notionBlocksToTiptapDoc } from './blocks-to-tiptap'

// 100 pages at page_size: 100 is 10,000 rows — a sane cap. If Notion ever
// returned the same cursor twice, this stops the loop from spinning forever;
// resolveChildren recurses and fans out, so this is the more exposed of the
// two pagination loops.
const MAX_PAGINATION_PAGES = 100

class NotionBlockPaginationOverflowError extends Error {
  constructor(blockId: string) {
    super(`listAllBlockChildren exceeded ${MAX_PAGINATION_PAGES} pages for block "${blockId}" — the cursor may be stuck`)
    this.name = 'NotionBlockPaginationOverflowError'
  }
}

/**
 * blocks.children.list caps page_size at 100 and returns has_more + next_cursor.
 * Both read sites ignored them, truncating long SOW documents and long lists.
 * see ../../DOCS.md#reads-paginate
 */
async function listAllBlockChildren(blockId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = []
  let cursor: string | undefined
  let page = 0

  do {
    page++
    if (page > MAX_PAGINATION_PAGES) {
      throw new NotionBlockPaginationOverflowError(blockId)
    }

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
