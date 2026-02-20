import { queryNotionDatabase } from '@/shared/services/notion/dal/query-notion-database'

(async () => {
  const data = await queryNotionDatabase('trades')

  console.log(JSON.stringify(data[0].properties, null, 2))
})()
