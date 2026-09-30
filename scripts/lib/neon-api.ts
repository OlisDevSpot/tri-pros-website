import type { NeonBranch, NeonEndpoint } from './neon-refresh'
import process from 'node:process'

const NEON_API = 'https://console.neon.tech/api/v2'
const FAILED_STATES = new Set(['failed', 'error', 'cancelled'])

export interface NeonOperation {
  id: string
  action: string
  status: string
  error?: string
}

export interface NeonClient {
  listBranches: () => Promise<NeonBranch[]>
  listEndpoints: () => Promise<NeonEndpoint[]>
  // Neon's "reset from parent" is the restore endpoint with the parent as
  // source and no timestamp/LSN, i.e. the parent's head.
  resetFromParent: (branchId: string, parentId: string) => Promise<NeonOperation[]>
  waitForOperations: (ops: NeonOperation[], timeoutMs?: number) => Promise<void>
}

export function createNeonClient(): NeonClient {
  const apiKey = process.env.NEON_API_KEY
  const projectId = process.env.NEON_PROJECT_ID
  if (!apiKey || !projectId)
    throw new Error('NEON_API_KEY and NEON_PROJECT_ID must be set in .env (dispatch uses the same two)')

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${NEON_API}/projects/${projectId}${path}`, {
      ...init,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok)
      throw new Error(`Neon API ${init.method ?? 'GET'} ${path} → ${res.status}: ${await res.text()}`)
    return res.json() as Promise<T>
  }

  async function waitForOne(op: NeonOperation, deadline: number): Promise<void> {
    let current = op
    while (current.status !== 'finished') {
      if (FAILED_STATES.has(current.status))
        throw new Error(`Neon operation ${current.action} (${current.id}) ${current.status}${current.error ? `: ${current.error}` : ''}`)
      if (Date.now() > deadline)
        throw new Error(`Timed out waiting for Neon operation ${current.action} (${current.id})`)
      await new Promise(resolve => setTimeout(resolve, 1500))
      const { operation } = await request<{ operation: NeonOperation }>(`/operations/${current.id}`)
      current = operation
    }
  }

  return {
    listBranches: async () => (await request<{ branches: NeonBranch[] }>('/branches')).branches,
    listEndpoints: async () => (await request<{ endpoints: NeonEndpoint[] }>('/endpoints')).endpoints,
    resetFromParent: async (branchId, parentId) => {
      const res = await request<{ operations: NeonOperation[] }>(`/branches/${branchId}/restore`, {
        method: 'POST',
        body: JSON.stringify({ source_branch_id: parentId }),
      })
      return res.operations
    },
    waitForOperations: async (ops, timeoutMs = 120_000) => {
      const deadline = Date.now() + timeoutMs
      for (const op of ops)
        await waitForOne(op, deadline)
    },
  }
}
