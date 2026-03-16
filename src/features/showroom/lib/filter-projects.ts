import type { ShowroomProject } from '@/shared/entities/projects/types'

interface FilterCriteria {
  tradeIds: string[]
  scopeIds: string[]
  search: string
  scopeToTradeMap: Map<string, string>
}

export function filterShowroomProjects(
  projects: ShowroomProject[],
  criteria: FilterCriteria,
): ShowroomProject[] {
  return projects.filter((item) => {
    // Search filter: match title, description, or backstory
    if (criteria.search) {
      const query = criteria.search.toLowerCase()
      const title = item.project.title.toLowerCase()
      const description = (item.project.description ?? '').toLowerCase()
      const backstory = (item.project.backstory ?? '').toLowerCase()
      if (!title.includes(query) && !description.includes(query) && !backstory.includes(query)) {
        return false
      }
    }

    // Trade filter: project must have at least one scope belonging to a matching trade
    if (criteria.tradeIds.length > 0) {
      const tradeIdSet = new Set(criteria.tradeIds)
      const hasMatchingTrade = item.scopeIds.some((scopeId) => {
        const tradeId = criteria.scopeToTradeMap.get(scopeId)
        return tradeId && tradeIdSet.has(tradeId)
      })
      if (!hasMatchingTrade) {
        return false
      }
    }

    // Scope filter: project must have at least one matching scope
    if (criteria.scopeIds.length > 0) {
      const scopeIdSet = new Set(item.scopeIds)
      if (!criteria.scopeIds.some(id => scopeIdSet.has(id))) {
        return false
      }
    }

    return true
  })
}
