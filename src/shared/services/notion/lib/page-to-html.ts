import type { NotionBlock } from '@notion-utils/html'
import { blocksToHtml } from '@notion-utils/html'
import { notionClient } from '../client'

export async function pageToHTML(pageId: string) {
  const response = await notionClient.blocks.children.list({
    block_id: pageId,
    page_size: 100,
  })

  const html = blocksToHtml(response.results as NotionBlock[])

  return html
}
