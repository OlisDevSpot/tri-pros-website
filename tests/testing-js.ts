/* eslint-disable no-console */
import type { NotionBlock } from '@notion-utils/html'
import { notionBlocksToTiptapDoc } from '@/shared/modules/construction/sources/notion/blocks-to-tiptap'
import { notionClient } from '@/shared/services/providers/notion/client'

(async () => {
  const response = await notionClient.blocks.children.list({
    block_id: '3150ca1b548b80f6b1a4f21efa09379d',
    page_size: 100,
  }) as { results: NotionBlock[] }

  const data = response.results
  const tiptapJSON = notionBlocksToTiptapDoc(data)

  console.log(JSON.stringify(tiptapJSON, null, 2))
})()
