import type { NotionBlock } from '@notion-utils/html'
import { notionClient } from '../client'
import { notionBlocksToTiptapDoc } from './blocks-to-tiptap-json'

/**
 * Recursively fetch children for blocks that have nested content
 * (e.g. nested list items inside a bulleted_list_item).
 */
async function resolveChildren(blocks: NotionBlock[]): Promise<NotionBlock[]> {
  return Promise.all(
    blocks.map(async (block) => {
      if (!block.has_children)
        return block

      const childResponse = await notionClient.blocks.children.list({
        block_id: block.id,
        page_size: 100,
      }) as { results: NotionBlock[] }

      const children = await resolveChildren(childResponse.results)

      return { ...block, children }
    }),
  )
}

export async function pageToTiptapJson(pageId: string) {
  const response = await notionClient.blocks.children.list({
    block_id: pageId,
    page_size: 100,
  }) as { results: NotionBlock[] }

  const blocks = await resolveChildren(response.results)
  const tiptapJson = notionBlocksToTiptapDoc(blocks)

  return JSON.stringify(tiptapJson)
}
