import { redirect } from 'next/navigation'

/** Redirect old /dashboard/pipelines to new route */
export default function PipelinesRedirect() {
  redirect('/dashboard/pipeline/fresh')
}
