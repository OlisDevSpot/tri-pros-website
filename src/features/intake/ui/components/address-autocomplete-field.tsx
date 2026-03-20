'use client'

import { Map, useMapsLibrary } from '@vis.gl/react-google-maps'
import { MapPinIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'

interface AddressFields {
  address: string
  city: string
  state: string
  zip: string
}

interface AddressAutocompleteFieldProps {
  onChange: (fields: AddressFields) => void
  onClear: () => void
}

interface LatLng { lat: number, lng: number }

export function AddressAutocompleteField({ onChange, onClear }: AddressAutocompleteFieldProps) {
  const placesLib = useMapsLibrary('places')
  const inputRef = useRef<HTMLInputElement>(null)
  const [resolvedLoc, setResolvedLoc] = useState<LatLng | null>(null)
  const [displayValue, setDisplayValue] = useState('')

  useEffect(() => {
    if (!placesLib || !inputRef.current) {
      return
    }

    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'us' },
      fields: ['address_components', 'formatted_address', 'geometry'],
    })

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.address_components) {
        return
      }

      const get = (type: string) =>
        place.address_components?.find(c => c.types.includes(type))?.long_name ?? ''
      const getShort = (type: string) =>
        place.address_components?.find(c => c.types.includes(type))?.short_name ?? ''

      const streetNumber = get('street_number')
      const route = get('route')
      const address = [streetNumber, route].filter(Boolean).join(' ')
      const city = get('locality') || get('sublocality') || get('administrative_area_level_2')
      const state = getShort('administrative_area_level_1')
      const zip = get('postal_code')

      if (place.geometry?.location) {
        setResolvedLoc({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        })
      }

      setDisplayValue(place.formatted_address ?? address)
      onChange({ address, city, state, zip })
    })

    return () => placesLib.event.clearInstanceListeners(autocomplete)
  }, [placesLib, onChange])

  function handleClear() {
    setDisplayValue('')
    setResolvedLoc(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
    onClear()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <MapPinIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          className="pl-8 pr-8"
          placeholder="Start typing an address…"
          value={displayValue}
          onChange={e => setDisplayValue(e.target.value)}
        />
        {displayValue && (
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-1 top-1/2 size-6 -translate-y-1/2"
            onClick={handleClear}
          >
            <XIcon className="size-3" />
          </Button>
        )}
      </div>

      {resolvedLoc && (
        <div className="h-[200px] overflow-hidden rounded-lg border border-border md:h-[240px]">
          <Map
            center={resolvedLoc}
            zoom={16}
            gestureHandling="none"
            disableDefaultUI
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )}
    </div>
  )
}
