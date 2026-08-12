/**
 * Pure extraction of de-duped scope ids from a set of proposals' SOWs.
 * Lifted from `business.router.ts`'s project-creation flow (Task 4, phase 1
 * standardization) — no `db` import, safe to unit test / reuse.
 */
export function extractScopeIdsFromProposals(
  proposals: { projectJSON: unknown }[],
): string[] {
  const scopeIds = new Set<string>()
  for (const p of proposals) {
    const sow = (p.projectJSON as Record<string, any>)?.data?.sow
    if (Array.isArray(sow)) {
      for (const entry of sow) {
        if (Array.isArray(entry.scopes)) {
          for (const scope of entry.scopes) {
            if (scope.id) {
              scopeIds.add(scope.id)
            }
          }
        }
      }
    }
  }

  return Array.from(scopeIds)
}
