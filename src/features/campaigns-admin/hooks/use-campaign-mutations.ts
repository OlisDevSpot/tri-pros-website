'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

/**
 * Campaign control-center mutations, wrapped with invalidation + toast — the
 * same convention as `use-lead-source-actions.ts`. Every mutation invalidates
 * the voip-campaigns router (self-healing pathFilter), so counts/lists/badges
 * refetch without manual key juggling.
 */
export function useCampaignMutations() {
  const trpc = useTRPC()
  const { invalidateVoipCampaigns } = useInvalidation()

  // Bulk ops dispatch background QStash jobs — the leads list won't reflect
  // results synchronously, and there's no realtime kernel yet. Invalidate on a
  // short delay (+ a retry) so a slightly-later refetch picks up progress as the
  // job runs. No optimistic status: the per-lead gate chain skips some leads, so
  // optimism would lie.
  const scheduleBulkRefetch = () => {
    setTimeout(() => invalidateVoipCampaigns(), 2000)
    setTimeout(() => invalidateVoipCampaigns(), 5000)
  }

  const resync = useMutation(
    trpc.voipCampaignsRouter.resyncFromCloudtalk.mutationOptions({
      onSuccess: (res) => {
        invalidateVoipCampaigns()
        toast.success(
          `Synced ${res.campaignsSynced} campaign(s), ${res.attributesSynced} attribute(s)`,
        )
        // Explain any campaign that didn't sync so "2 of 3" isn't a mystery.
        const noTag = res.skippedCampaigns
          .filter(c => c.reason === 'no_membership_tag')
          .map(c => c.name)
        if (noTag.length > 0) {
          toast.warning(
            `Skipped ${noTag.length} campaign(s) with no membership tag: ${noTag.join(', ')}. `
            + 'Add a contact-list tag to the campaign in CloudTalk, then resync.',
            { duration: 12000 },
          )
        }
      },
      onError: err => toast.error(err.message || 'Resync failed'),
    }),
  )

  const setSourcePolicy = useMutation(
    trpc.voipCampaignsRouter.setSourcePolicy.mutationOptions({
      onSuccess: () => {
        invalidateVoipCampaigns()
        toast.success('Source policy updated')
      },
      onError: err => toast.error(err.message || 'Failed to update source policy'),
    }),
  )

  const setCampaignSmsCadence = useMutation(
    trpc.voipCampaignsRouter.setCampaignSmsCadence.mutationOptions({
      onSuccess: () => {
        invalidateVoipCampaigns()
        toast.success('Cadence saved')
      },
      onError: err => toast.error(err.message || 'Failed to save cadence'),
    }),
  )

  const enrollAll = useMutation(
    trpc.voipCampaignsRouter.enrollAll.mutationOptions({
      onSuccess: () => {
        // The batch runs as a background QStash job — counts update on the next
        // refetch, not synchronously. Invalidate so a slightly-later refetch
        // picks up early progress.
        invalidateVoipCampaigns()
        toast.success('Enroll-all queued — leads are being pushed to CloudTalk')
      },
      onError: err => toast.error(err.message || 'Failed to queue enroll-all'),
    }),
  )

  const unenrollAll = useMutation(
    trpc.voipCampaignsRouter.unenrollAll.mutationOptions({
      onSuccess: (res) => {
        if (res.queued === 0) {
          toast.info('No active leads to unenroll')
          return
        }
        toast.success(`Unenrolling ${res.queued} lead(s) in the background…`)
        scheduleBulkRefetch()
      },
      onError: err => toast.error(err.message || 'Failed to unenroll'),
    }),
  )

  const disqualify = useMutation(
    trpc.voipCampaignsRouter.disqualify.mutationOptions({
      onSuccess: () => {
        invalidateVoipCampaigns()
        toast.success('Lead disqualified — stopped calling')
      },
      onError: err => toast.error(err.message || 'Failed to disqualify lead'),
    }),
  )

  const disqualifyBulk = useMutation(
    trpc.voipCampaignsRouter.disqualifyBulk.mutationOptions({
      onSuccess: (res) => {
        toast.success(`Disqualifying ${res.queued} lead(s) in the background…`)
        scheduleBulkRefetch()
      },
      onError: err => toast.error(err.message || 'Failed to disqualify leads'),
    }),
  )

  const removeFromCampaign = useMutation(
    trpc.voipCampaignsRouter.removeFromCampaign.mutationOptions({
      onSuccess: () => {
        invalidateVoipCampaigns()
        toast.success('Removed from campaign — can be re-enrolled later')
      },
      onError: err => toast.error(err.message || 'Failed to remove from campaign'),
    }),
  )

  const enroll = useMutation(
    trpc.voipCampaignsRouter.enroll.mutationOptions({
      onSuccess: () => {
        invalidateVoipCampaigns()
        toast.success('Enrolled into campaign')
      },
      onError: err => toast.error(err.message || 'Failed to enroll'),
    }),
  )

  const enrollSelected = useMutation(
    trpc.voipCampaignsRouter.enrollSelected.mutationOptions({
      onSuccess: (res) => {
        toast.success(`Enrolling ${res.queued} lead(s) in the background…`, {
          description: 'Some may be skipped — already enrolled / DNC / no phone.',
        })
        scheduleBulkRefetch()
      },
      onError: err => toast.error(err.message || 'Failed to enroll selected leads'),
    }),
  )

  const removeBulk = useMutation(
    trpc.voipCampaignsRouter.removeBulk.mutationOptions({
      onSuccess: (res) => {
        toast.success(`Removing ${res.queued} lead(s) in the background — re-enrollable`)
        scheduleBulkRefetch()
      },
      onError: err => toast.error(err.message || 'Failed to remove leads'),
    }),
  )

  const switchCampaign = useMutation(
    trpc.voipCampaignsRouter.switchCampaign.mutationOptions({
      onSuccess: () => {
        invalidateVoipCampaigns()
        toast.success('Lead moved to the new campaign')
      },
      onError: err => toast.error(err.message || 'Failed to switch campaign'),
    }),
  )

  const markDnc = useMutation(
    trpc.voipCampaignsRouter.markDnc.mutationOptions({
      onSuccess: (res) => {
        toast.success(`Marking ${res.queued} lead(s) Do-Not-Call in the background…`)
        scheduleBulkRefetch()
      },
      onError: err => toast.error(err.message || 'Failed to mark DNC'),
    }),
  )

  const removeDnc = useMutation(
    trpc.voipCampaignsRouter.removeDnc.mutationOptions({
      onSuccess: () => {
        invalidateVoipCampaigns()
        toast.success('DNC cleared — lead can be contacted again')
      },
      onError: err => toast.error(err.message || 'Failed to clear DNC'),
    }),
  )

  return {
    resync,
    setSourcePolicy,
    setCampaignSmsCadence,
    enrollAll,
    unenrollAll,
    disqualify,
    disqualifyBulk,
    removeFromCampaign,
    enroll,
    enrollSelected,
    removeBulk,
    switchCampaign,
    markDnc,
    removeDnc,
  }
}
