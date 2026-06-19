// src/shared/domains/funnels/ui/steps/address-preview.tsx
import { MapPin } from 'lucide-react'
import { googleMapsClient } from '@/shared/services/providers/google-maps/client'

/**
 * Funnel-local preview of the picked place — AERIAL ONLY. Street View is omitted
 * on the lead funnel because a photo of the prospect's house feels intrusive.
 * Built from a static-map URL; renders only once an address is picked.
 */
export function AddressPreview({ fullAddress }: { fullAddress: string }) {
  const aerialSrc = googleMapsClient.hasKey()
    ? googleMapsClient.aerialStaticMapUrl(fullAddress, '640x480')
    : null

  return (
    <div className="space-y-2">
      <div className="border-border bg-muted relative aspect-4/3 overflow-hidden rounded-lg border">
        {aerialSrc
          ? <img alt="" className="size-full object-cover" src={aerialSrc} />
          : (
              <div className="text-muted-foreground grid size-full place-items-center text-xs">
                No preview
              </div>
            )}
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur-sm">
          Aerial
        </span>
      </div>
      <div className="border-border bg-muted/40 flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
        <MapPin className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 wrap-break-word font-medium">{fullAddress}</span>
      </div>
    </div>
  )
}
