export interface NeonBranch {
  id: string
  name: string
  parent_id?: string
  default: boolean
  protected: boolean
  current_state: string
}

export interface NeonEndpoint {
  id: string
  host: string
  branch_id: string
}

/**
 * `ep-mute-sunset-afxp3pn5-pooler.c-2.us-west-2.aws.neon.tech` → `ep-mute-sunset-afxp3pn5`.
 * Comparing endpoint ids, not URL strings, is what catches a pooler and a
 * direct host that point at the same branch.
 */
export function endpointIdFromUrl(connectionString: string): string {
  const host = new URL(connectionString).hostname
  const label = host.split('.')[0]
  if (!label.startsWith('ep-'))
    throw new Error(`Not a Neon host: ${host}`)
  return label.replace(/-pooler$/, '')
}

export type TargetResolution
  = | { ok: true, branch: NeonBranch, parent: NeonBranch }
    | { ok: false, reason: string }

export function resolveTarget(input: {
  branches: NeonBranch[]
  endpoints: NeonEndpoint[]
  devEndpointId: string
  prodEndpointId: string
}): TargetResolution {
  const { branches, endpoints, devEndpointId, prodEndpointId } = input
  if (devEndpointId === prodEndpointId)
    return { ok: false, reason: `DATABASE_DEV_URL and DATABASE_URL point at the same endpoint (${devEndpointId})` }
  const endpoint = endpoints.find(e => e.id === devEndpointId)
  if (!endpoint)
    return { ok: false, reason: `No Neon endpoint ${devEndpointId} in this project — is DATABASE_DEV_URL from another project?` }
  const branch = branches.find(b => b.id === endpoint.branch_id)
  if (!branch)
    return { ok: false, reason: `Endpoint ${devEndpointId} belongs to unknown branch ${endpoint.branch_id}` }
  if (branch.default)
    return { ok: false, reason: `${branch.name} is the project's default branch — refusing to reset it` }
  if (branch.protected)
    return { ok: false, reason: `${branch.name} is protected — refusing to reset it` }
  if (!branch.parent_id)
    return { ok: false, reason: `${branch.name} is a root branch — nothing to reset from` }
  const parent = branches.find(b => b.id === branch.parent_id)
  if (!parent)
    return { ok: false, reason: `Parent ${branch.parent_id} of ${branch.name} not found` }
  return { ok: true, branch, parent }
}

export function childrenOf(branches: NeonBranch[], branchId: string): NeonBranch[] {
  return branches.filter(b => b.parent_id === branchId)
}

/**
 * What a prod copy must not carry into dev: device-bound auth and push rows,
 * third-party OAuth and webhook state, and the Google Calendar / e-signature
 * ids that would make dev act on prod's calendars and envelopes.
 */
export const SCRUB_STATEMENTS: readonly string[] = [
  'DELETE FROM "session"',
  'DELETE FROM "account"',
  'DELETE FROM "verification"',
  'DELETE FROM "push_subscriptions"',
  'DELETE FROM "qb_auth_tokens"',
  'DELETE FROM "bina_webhook_logs"',
  'UPDATE "meetings" SET gcal_event_id = NULL, gcal_etag = NULL, gcal_synced_at = NULL WHERE gcal_event_id IS NOT NULL OR gcal_etag IS NOT NULL OR gcal_synced_at IS NOT NULL',
  'UPDATE "activities" SET gcal_event_id = NULL, gcal_etag = NULL, gcal_synced_at = NULL WHERE gcal_event_id IS NOT NULL OR gcal_etag IS NOT NULL OR gcal_synced_at IS NOT NULL',
  'UPDATE "proposals" SET contract_envelope_id = NULL WHERE contract_envelope_id IS NOT NULL',
]
