// Local source: signed customers (≥1 project) per adKey. Thin adapter over the
// customers DAL — imports NO db.
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { signedByAdKey } from '@/shared/entities/customers/dal/server/ad-performance'
import { source } from '../../types'

export const signedPerAdKey = source({
  key: 'adKey',
  load: async ({ range }) => dalVerifySuccess(await signedByAdKey(range)),
})
