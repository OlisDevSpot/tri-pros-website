/* eslint-disable node/prefer-global/process */
'use client'

import type { AddressFields } from '@/shared/lib/google-maps-helpers'
import { useMutation } from '@tanstack/react-query'
import { APIProvider } from '@vis.gl/react-google-maps'
import { CheckCircle2Icon, MapPinIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/shared/components/dialogs/modals/base-modal'
import { AddressAutocomplete } from '@/shared/components/inputs/address-autocomplete'
import { Button } from '@/shared/components/ui/button'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import {
  buildAerialStaticMapUrl,
  buildStreetViewStaticUrl,
  hasGoogleMapsKey,
} from '@/shared/services/google-maps/static-urls'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  customerId: string
  isOpen: boolean
  onClose: () => void
  /**
   * Current address string — rendered for context so the user knows what
   * they are replacing.
   */
  defaultAddress?: string
}

export function AddressEditDialog({ customerId, isOpen, onClose, defaultAddress }: Props) {
  const trpc = useTRPC()
  const { invalidateCustomer } = useInvalidation()
  const [picked, setPicked] = useState<AddressFields | null>(null)

  const updateContact = useMutation(
    trpc.customersRouter.updateCustomerContact.mutationOptions({
      onSuccess: () => {
        invalidateCustomer()
        toast.success('Address updated')
        handleClose()
      },
      onError: err => toast.error(err.message),
    }),
  )

  function handleSave() {
    if (!picked) {
      return
    }
    updateContact.mutate({
      customerId,
      address: picked.address,
      city: picked.city,
      state: picked.state || 'CA',
      zip: picked.zip,
    })
  }

  function handleClose() {
    setPicked(null)
    onClose()
  }

  return (
    <Modal
      className="sm:max-w-2xl"
      close={handleClose}
      description="Type an address and pick a match from the suggestions — we'll parse the street, city, state, and zip in one shot."
      isOpen={isOpen}
      title="Edit address"
    >
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''}>
        <div className="flex flex-col gap-4 pt-1">
          <AddressAutocomplete
            defaultValue={defaultAddress}
            onSelect={setPicked}
            showMap={false}
          />

          {picked
            ? <SelectedPreview fullAddress={picked.fullAddress} />
            : <EmptyPreview currentAddress={defaultAddress} />}

          <div className="flex items-center justify-between gap-2 pt-2">
            <p className="text-xs text-muted-foreground">
              {picked
                ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2Icon className="size-3.5 text-emerald-500" />
                      Ready to save
                    </span>
                  )
                : (
                    <span>Select an address to continue</span>
                  )}
            </p>
            <div className="flex gap-2">
              <Button
                disabled={updateContact.isPending}
                onClick={handleClose}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                disabled={!picked || updateContact.isPending}
                onClick={handleSave}
              >
                {updateContact.isPending ? 'Saving…' : 'Save address'}
              </Button>
            </div>
          </div>
        </div>
      </APIProvider>
    </Modal>
  )
}

// Two-up preview of the newly picked place — aerial + street, built from
// static-map URLs so it matches the customer hero look and avoids an extra
// interactive map widget.
function SelectedPreview({ fullAddress }: { fullAddress: string }) {
  const mapsKeyPresent = hasGoogleMapsKey()
  const aerialUrl = mapsKeyPresent ? buildAerialStaticMapUrl(fullAddress, '640x480') : null
  const streetUrl = mapsKeyPresent ? buildStreetViewStaticUrl(fullAddress, '640x480') : null

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 overflow-hidden rounded-lg border border-border">
        <PreviewTile
          label="Aerial"
          src={aerialUrl}
        />
        <PreviewTile
          label="Street"
          src={streetUrl}
        />
      </div>
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
        <MapPinIcon className="mt-0.5 size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 wrap-break-word font-medium">{fullAddress}</span>
      </div>
    </div>
  )
}

function PreviewTile({ label, src }: { label: string, src: string | null }) {
  return (
    <div className="relative aspect-4/3 bg-muted">
      {src
        ? (
            <img
              alt=""
              className="size-full object-cover"
              src={src}
            />
          )
        : (
            <div className="grid size-full place-items-center text-xs text-muted-foreground">
              No preview
            </div>
          )}
      <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur-sm">
        {label}
      </span>
    </div>
  )
}

function EmptyPreview({ currentAddress }: { currentAddress?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
      <div className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <MapPinIcon className="size-4" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Start typing above</p>
        <p className="text-xs text-muted-foreground">
          Pick a Google Places match to preview aerial + street views before saving.
        </p>
      </div>
      {currentAddress && (
        <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
          <span className="shrink-0 font-semibold text-foreground/70">Currently:</span>
          <span className="truncate">{currentAddress}</span>
        </div>
      )}
    </div>
  )
}
