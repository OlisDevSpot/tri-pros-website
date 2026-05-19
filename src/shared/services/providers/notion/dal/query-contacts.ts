import { notionClient } from '../client'
import { notionDatabasesMeta } from '../constants/databases'

export async function queryContactsDatabase(name: string) {
  const response = await notionClient.dataSources.query({
    data_source_id: notionDatabasesMeta.contacts.id,
    filter: {
      property: 'Name',
      title: {
        contains: name,
      },
    },
  })

  return response
}
