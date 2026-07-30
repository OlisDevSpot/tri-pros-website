// Local source: appointments (distinct customers with ≥1 meeting) per adKey. Thin
// adapter over the customers DAL — imports NO db.
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { appointmentsByAdKey } from '@/shared/entities/customers/dal/server/ad-performance'
import { source } from '../../types'

export const appointmentsPerAdKey = source({
  key: 'adKey',
  load: async ({ range }) => dalVerifySuccess(await appointmentsByAdKey(range)),
})
