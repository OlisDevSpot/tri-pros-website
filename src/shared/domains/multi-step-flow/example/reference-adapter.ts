import type { EngineState, StepPersistenceAdapter } from '../types'

/**
 * Module-scoped in-memory adapter for the reference flow. Persists across
 * re-renders/remounts within a dev session (no localStorage, no DB). Sync
 * load -> no `useHydration`. NOT for production.
 */
export function createInMemoryAdapter(): StepPersistenceAdapter<EngineState> {
  let snapshot: EngineState | null = null
  return {
    load: () => snapshot,
    persist: (next) => {
      snapshot = next
    },
  }
}
