# Task #14 — Progressive Agent Permissions (Customer Files)

## Summary

Agents should have **zero default access** to customer files. Super-admin explicitly grants file visibility per agent. This covers telemarketing recordings (MP3s), signed contracts, proposal PDFs, project photos, and any future per-customer documents stored in R2.

## R2 Architecture

- **Bucket**: `tpr-homeowner-files` (private — no public URL)
- **Endpoint**: `https://386c44c92bfa17505ba309cd33e47ae9.r2.cloudflarestorage.com/tpr-homeowner-files`
- **Key patterns**:
  - `recordings/{slug}-{uuid}.mp3` — telemarketing recordings (from intake form, no customerId at upload time)
  - `{customerId}/contracts/...` — signed contracts (future)
  - `{customerId}/{projectAddress}/photos/...` — project photos (future)
  - `{customerId}/{projectAddress}/proposals/...` — proposal PDFs (future)
- **Access method**: Presigned URLs only — never public. PG is the index, R2 is dumb blob storage.
- **Public buckets** (unrelated): `tpr-portfolio-projects`, `tpr-company-docs` have public dev URLs. `tpr-homeowner-files` does NOT.

## CASL Integration Plan

### Current state (as of migration)
- `AppSubjects` in `src/shared/permissions/types.ts`: `'Customer' | 'CustomerPipeline' | 'Dashboard' | 'Meeting' | 'Project' | 'Proposal' | 'User' | 'all'`
- `AppActions`: `'access' | 'assign' | 'create' | 'delete' | 'manage' | 'read' | 'update'`
- Super-admin: `can('manage', 'all')` — already covers everything
- Agents: explicit per-resource grants, no `CustomerFile` subject exists yet

### Step 1: Add CASL subject (do during migration or as prep)
- Add `'CustomerFile'` to `AppSubjects` in `src/shared/permissions/types.ts`
- **Do NOT** add any `can('read', 'CustomerFile')` to the agent role — default deny
- Super-admin already covered by `can('manage', 'all')`

### Step 2: File visibility grant system (this task)
- **Option A — DB table**: `customer_file_grants` table with `agentId`, `customerId` (or `fileKey`), `grantedBy`, `grantedAt`
- **Option B — Per-file flag**: Add `visibleToAgentIds: text[]` column on a `customer_files` registry table
- **Recommendation**: Option A is cleaner — separate grant table, easy to query, easy to revoke

### Step 3: Presigned URL procedure
- tRPC procedure behind `agentProcedure`
- Checks: `ctx.ability.can('read', 'CustomerFile')` OR `ctx.ability.can('manage', 'all')`
- If agent: query `customer_file_grants` to verify explicit grant exists for this agent + this customer/file
- If super-admin: skip grant check (manage all)
- Generate presigned URL with short TTL (15 min)

### Step 4: Super-admin grant UI
- In customer profile modal or dedicated file management view
- Super-admin sees all files for a customer
- Toggle/checkbox to make specific files (or all files) visible to the assigned agent
- Creates/deletes rows in `customer_file_grants`

### Step 5: Agent file browser (Task #13)
- Agent sees only files they've been granted access to
- MP3 player component for recordings
- Document preview for PDFs
- Organized by customer

## Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Default agent access | **Deny all** | Files contain sensitive customer data; access must be explicitly granted |
| Grant granularity | **Per-customer** (not per-file) | Simpler UX for super-admin; granting access to a customer reveals all their files |
| R2 key strategy | **Flat keys with PG index** | R2 is not searchable; PG `customer_files` or `leadMetaJSON` is the lookup layer |
| Presigned URL TTL | **15 minutes** | Short enough to prevent link sharing, long enough for playback/download |
| Super-admin rule | `can('manage', 'all')` | Already exists — no changes needed. This is a core system invariant. |

## Dependencies

- Task #1 (Notion CRM Migration) must complete first — customers and `leadMetaJSON` with `mp3RecordingKey` must exist
- R2 bucket `tpr-homeowner-files` must be created in Cloudflare dashboard
- `CustomerFile` CASL subject should be added during migration (prep step)

## Files to create/modify

| File | Action |
|------|--------|
| `src/shared/permissions/types.ts` | Add `'CustomerFile'` to `AppSubjects` |
| `src/shared/permissions/abilities.ts` | No change needed (agent gets no `CustomerFile` permissions) |
| `src/shared/db/schema/customer-file-grants.ts` | New table: `id`, `agentId`, `customerId`, `grantedBy`, `grantedAt` |
| `src/shared/db/schema/index.ts` | Export new table |
| `src/trpc/routers/customer-files.router.ts` | New router: `getFileUrl`, `listFiles`, `grantAccess`, `revokeAccess` |
| `src/trpc/routers/app.ts` | Register new router |
| `src/features/customer-files/` | New feature: file browser UI, grant management UI |
