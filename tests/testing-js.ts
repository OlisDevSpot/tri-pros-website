/* eslint-disable no-console */
import type { NotionBlock } from '@notion-utils/html'
import { notionClient } from '@/shared/services/notion/client'
import { notionBlocksToTiptapDoc } from '@/shared/services/notion/lib/blocks-to-tiptap-json'

(async () => {
  const response = await notionClient.blocks.children.list({
    block_id: '3150ca1b548b80f6b1a4f21efa09379d',
    page_size: 100,
  }) as { results: NotionBlock[] }

  const data = response.results
  const tiptapJSON = notionBlocksToTiptapDoc(data)

  console.log(JSON.stringify(tiptapJSON, null, 2))
})()
