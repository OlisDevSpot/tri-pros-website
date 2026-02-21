/* eslint-disable no-console */
import { queryNotionDatabase } from '@/shared/services/notion/dal/query-notion-database'
import { pageToScope } from '@/shared/services/notion/lib/scopes/adapter'

(async () => {
  const data = await queryNotionDatabase('scopes', {
    query: 'a9c0ca1b548b835b93128152b409d577',
    filterProperty: 'relatedTrade',
  })

  console.log(JSON.stringify(data?.map(page => pageToScope(page)), null, 2))
})()
