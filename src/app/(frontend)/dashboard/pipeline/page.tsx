import { redirect } from 'next/navigation'

import { ROOTS } from '@/shared/config/roots'

/** Bare /dashboard/pipeline redirects to /dashboard/pipeline/fresh */
export default function PipelineIndexRedirect() {
  redirect(ROOTS.dashboard.pipeline())
}
