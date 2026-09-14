import type { ProposalIncentiveRow } from '@/shared/db/schema/proposal-incentives'

import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { recomputeProposalFinancials } from '@/shared/modules/proposals/core/dal/server/mutations'
import { proposalIncentiveServerSpec } from '@/shared/modules/proposals/incentives/server-spec'

/**
 * CRUD handlers for proposal incentive rows. Discount rows are a direct term in
 * the parent's `final_tcp_cents` formula, so EVERY single-row write re-drives
 * the parent rollup through the factory hooks — cheap, idempotent, and it means
 * no origin (service, script, future tRPC leaf) can leave the cache column
 * stale. The multi-row replace-all (mutations.ts) re-drives once itself.
 *
 * Not gated here: the proposal lock ladder for single-row writes. Today the only
 * single-row origin is the duplicate-clone onto a fresh (unlocked) draft; the
 * gate lands with the first user-facing single-row leaf (W4 owns that surface).
 * see ../../../core/DOCS.md#final-tcp-derived
 */
export const proposalIncentiveCrud = createCrudDal(proposalIncentiveServerSpec, () => ({
  hooks: {
    create: {
      async after(row: ProposalIncentiveRow, _ctx) {
        dalVerifySuccess(await recomputeProposalFinancials(row.proposalId))
      },
    },
    update: {
      async after(row: ProposalIncentiveRow, _ctx, meta) {
        dalVerifySuccess(await recomputeProposalFinancials(row.proposalId))
        if (meta.previousRow.proposalId !== row.proposalId) {
          dalVerifySuccess(await recomputeProposalFinancials(meta.previousRow.proposalId))
        }
      },
    },
    delete: {
      async after(row: ProposalIncentiveRow, _ctx) {
        dalVerifySuccess(await recomputeProposalFinancials(row.proposalId))
      },
    },
  },
}))
