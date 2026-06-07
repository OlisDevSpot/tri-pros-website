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

  const resync = useMutation(
    trpc.voipCampaignsRouter.resyncFromCloudtalk.mutationOptions({
      onSuccess: (res) => {
        invalidateVoipCampaigns()
        toast.success(
          `Synced ${res.campaignsSynced} campaign(s), ${res.attributesSynced} attribute(s)`,
        )
      },
      onError: err => toast.error(err.message || 'Resync failed'),
    }),
  )

  const bindCampaignToSource = useMutation(
    trpc.voipCampaignsRouter.bindCampaignToSource.mutationOptions({
      onSuccess: () => {
        invalidateVoipCampaigns()
        toast.success('Campaign binding updated')
      },
      onError: err => toast.error(err.message || 'Failed to bind campaign'),
    }),
  )

  const setDefaultCampaign = useMutation(
    trpc.voipCampaignsRouter.setDefaultCampaign.mutationOptions({
      onSuccess: () => {
        invalidateVoipCampaigns()
        toast.success('Default campaign updated')
      },
      onError: err => toast.error(err.message || 'Failed to set default campaign'),
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
        invalidateVoipCampaigns()
        toast.success(`Unenrolled ${res.unenrolled} of ${res.active} lead(s)`)
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
        invalidateVoipCampaigns()
        toast.success(`Disqualified ${res.unenrolled} of ${res.requested} lead(s)`)
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
        invalidateVoipCampaigns()
        toast.success(`Enrolled ${res.enrolled} of ${res.requested} lead(s)`, {
          description: res.enrolled < res.requested
            ? 'Some were skipped — check eligibility (already enrolled / DNC / no phone).'
            : undefined,
        })
      },
      onError: err => toast.error(err.message || 'Failed to enroll selected leads'),
    }),
  )

  const removeBulk = useMutation(
    trpc.voipCampaignsRouter.removeBulk.mutationOptions({
      onSuccess: (res) => {
        invalidateVoipCampaigns()
        toast.success(`Removed ${res.removed} of ${res.requested} lead(s) — re-enrollable`)
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
        invalidateVoipCampaigns()
        toast.success(`Marked ${res.count} lead(s) Do-Not-Call — unenrolled`)
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
    bindCampaignToSource,
    setDefaultCampaign,
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
