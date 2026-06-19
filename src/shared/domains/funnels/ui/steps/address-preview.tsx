import { MapPin } from 'lucide-react'
import { googleMapsClient } from '@/shared/services/providers/google-maps/client'

/**
 * Funnel-local two-up preview of the picked place — aerial + street, built from
 * static-map URLs. Mirrors the customer-profile SelectedPreview look without
 * importing it (wrong dependency direction). Renders only once an address is
 * picked; the step shows a neutral placeholder before that.
 */
export function AddressPreview({ fullAddress }: { fullAddress: string }) {
  const mapsKeyPresent = googleMapsClient.hasKey()
  const tiles: { label: string, src: string | null }[] = [
    { label: 'Aerial', src: mapsKeyPresent ? googleMapsClient.aerialStaticMapUrl(fullAddress, '640x480') : null },
    { label: 'Street', src: mapsKeyPresent ? googleMapsClient.streetViewStaticUrl(fullAddress, '640x480') : null },
  ]

  return (
    <div className="space-y-2">
      <div className="border-border grid grid-cols-2 gap-2 overflow-hidden rounded-lg border">
        {tiles.map(tile => (
          <div key={tile.label} className="bg-muted relative aspect-4/3">
            {tile.src
              ? <img alt="" className="size-full object-cover" src={tile.src} />
              : (
                  <div className="text-muted-foreground grid size-full place-items-center text-xs">
                    No preview
                  </div>
                )}
            <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur-sm">
              {tile.label}
            </span>
          </div>
        ))}
      </div>
      <div className="border-border bg-muted/40 flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
        <MapPin className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 wrap-break-word font-medium">{fullAddress}</span>
      </div>
    </div>
  )
}
