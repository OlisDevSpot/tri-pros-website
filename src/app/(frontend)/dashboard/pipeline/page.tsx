import { redirect } from 'next/navigation'

/** Bare /dashboard/pipeline redirects to /dashboard/pipeline/fresh */
export default function PipelineIndexRedirect() {
  redirect('/dashboard/pipeline/fresh')
}
