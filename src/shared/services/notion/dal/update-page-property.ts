import { notionClient } from '../client'

export async function updatePageUrlProperty(pageId: string, propertyName: string, url: string) {
  await notionClient.pages.update({
    page_id: pageId,
    properties: {
      [propertyName]: {
        url,
      },
    },
  })
}

export async function updatePageRelationProperty(pageId: string, propertyId: string, entityId: string) {
  await notionClient.pages.update({
    page_id: pageId,
    properties: {
      [propertyId]: {
        relation: [{ id: entityId }],
      },
    },
  })
}
