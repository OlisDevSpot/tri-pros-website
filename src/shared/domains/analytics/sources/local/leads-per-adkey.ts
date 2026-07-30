// Local source: first-party paid-Meta lead count per adKey. Thin adapter over the
// customers DAL — imports NO db (SQL lives in the DAL, ADR-0002:157).
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { leadsByAdKey } from '@/shared/entities/customers/dal/server/ad-performance'
import { source } from '../../types'

export const leadsPerAdKey = source({
  key: 'adKey',
  load: async ({ range }) => dalVerifySuccess(await leadsByAdKey(range)),
})
