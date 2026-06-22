import { redirect } from 'next/navigation'

import { ROOTS } from '@/shared/config/roots'

/** Redirect old /dashboard/pipelines to new route */
export default function PipelinesRedirect() {
  redirect(ROOTS.dashboard.pipeline())
}
