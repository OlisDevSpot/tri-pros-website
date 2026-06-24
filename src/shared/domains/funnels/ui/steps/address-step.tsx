/* eslint-disable node/prefer-global/process */
import type { AddressStep, PiiAnswer, StepProps } from '@/shared/domains/funnels/types'
import type { AddressFields } from '@/shared/lib/google-maps-helpers'
import { APIProvider } from '@vis.gl/react-google-maps'
import { MapPin } from 'lucide-react'
import { AddressAutocomplete } from '@/shared/components/inputs/address-autocomplete'
import { useSetFunnelLeadAddress } from '@/shared/domains/funnels/hooks/use-set-funnel-lead-address'
import { AddressPreview } from '@/shared/domains/funnels/ui/steps/address-preview'

export function AddressStepView({ content, value, answers, setValue }: StepProps<AddressStep>) {
  const setLeadAddress = useSetFunnelLeadAddress()

  function handleSelect(fields: AddressFields) {
    setValue(fields)
    // Best-effort persist to the already-created funnel lead (#PII step). Skip
    // if we somehow have no leadId; re-firing on a re-pick is fine.
    const leadId = (answers.pii as PiiAnswer | null)?.leadId
    if (leadId) {
      setLeadAddress({
        leadId,
        address: fields.address,
        city: fields.city,
        state: fields.state || 'CA',
        zip: fields.zip,
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{content.title}</h2>
        {content.subtitle ? <p className="text-muted-foreground mt-1">{content.subtitle}</p> : null}
      </div>

      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''}>
        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
          <AddressAutocomplete
            autoFocus
            defaultValue={value?.fullAddress}
            onSelect={handleSelect}
            showMap={false}
            dropdownClassName="funnel-light text-foreground"
          />

          {value
            ? <AddressPreview fullAddress={value.fullAddress} />
            : (
                <div className="border-border bg-muted/30 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center">
                  <div className="bg-muted text-muted-foreground grid size-10 place-items-center rounded-full">
                    <MapPin className="size-4" aria-hidden="true" />
                  </div>
                  <p className="text-muted-foreground text-sm">Start typing above and pick your address.</p>
                </div>
              )}
        </div>
      </APIProvider>
    </div>
  )
}
