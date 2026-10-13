// server-spec.ts stays a PURE data object (imported by the DAL); the tRPC
// runtime is pulled in HERE, router-side, never into the entity/DAL layer.

import { baseProcedure } from '../../init'

/** No auth. Pass-through of baseProcedure — the public intake entrypoint enforces its own rate-limit + validation inline. */
export const customerPublicProcedure = baseProcedure
