import type { ShowroomProject } from '@/shared/entities/projects/types'

interface FilterCriteria {
  tradeIds: number[]
  scopeIds: number[]
  search: string
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

    // Trade filter: project must have at least one matching trade
    if (criteria.tradeIds.length > 0) {
      const projectTradeIds = new Set(item.trades.map(t => t.id))
      if (!criteria.tradeIds.some(id => projectTradeIds.has(id))) {
        return false
      }
    }

    // Scope filter: project must have at least one matching scope
    if (criteria.scopeIds.length > 0) {
      const projectScopeIds = new Set(item.scopes.map(s => s.id))
      if (!criteria.scopeIds.some(id => projectScopeIds.has(id))) {
        return false
      }
    }

    return true
  })
}
