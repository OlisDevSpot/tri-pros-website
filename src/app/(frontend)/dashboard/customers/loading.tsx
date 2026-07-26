import { LoadingState } from '@/shared/components/states/loading-state'

// Route-level loading boundary: gives soft navigations an instant commit point
// (the awaited Tier-2 prefetch otherwise freezes the previous page with zero
// feedback until the DB query completes) and replaces the blank content area
// on hard loads. In production it also unlocks Link partial prefetch down to
// this boundary. See audit C1.
export default function CustomersLoading() {
  return <LoadingState title="Loading customers…" />
}
