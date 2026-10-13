import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'

import { baseProcedure } from '../../init'
import { shareableMiddleware } from '../../lib/middleware/shareable-middleware'

/** Staff by session, or a homeowner by the proposal's share link. */
export const proposalShareableProcedure = baseProcedure.use(shareableMiddleware(proposalServerSpec))
