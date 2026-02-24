import type { BlockObjectResponse, PartialBlockObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { NotionRenderer } from '@notion-render/client'
import sanitizeHtml from 'sanitize-html'

type NotionBlock = BlockObjectResponse | PartialBlockObjectResponse

const renderer = new NotionRenderer()

export async function blocksToHtml(blocks: NotionBlock[]) {
  // Renderer expects blocks as varargs: render(...blocks) :contentReference[oaicite:3]{index=3}
  const raw = await renderer.render(...(blocks as any))

  // Keep this fairly permissive so TipTap gets nice structure,
  // but still block scripts / weird attributes.
  const clean = sanitizeHtml(raw, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img',
      'h1',
      'h2',
      'h3',
      'figure',
      'figcaption',
      'details',
      'summary',
    ]),
    allowedAttributes: {
      'a': ['href', 'name', 'target', 'rel'],
      'img': ['src', 'alt', 'title'],
      '*': ['class'],
    },
    // optional: enforce safe links
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  })

  return clean
}
