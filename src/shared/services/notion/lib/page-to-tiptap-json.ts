import type { NotionBlock } from '@notion-utils/html'
import { notionClient } from '../client'
import { notionBlocksToTiptapDoc } from './blocks-to-tiptap-json'

export async function pageToTiptapJson(pageId: string) {
  const response = await notionClient.blocks.children.list({
    block_id: pageId,
    page_size: 100,
  }) as { results: NotionBlock[] }

  const tiptapJson = notionBlocksToTiptapDoc(response.results)

  return JSON.stringify(tiptapJson)
}
