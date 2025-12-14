import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'

interface AddressInputProps {
  // onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  onPlaceChange?: (place: google.maps.places.PlaceResult) => void
}

export function AddressInput({
  // onChange,
  disabled = false,
  placeholder = 'Select an address',
  onPlaceChange,
}: AddressInputProps) {
  const [placeAutocomplete, setPlaceAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const placesAPI = useMapsLibrary('places')

  // Initialize Autocomplete
  useEffect(() => {
    if (!placesAPI || !inputRef.current || !window.google?.maps?.places)
      return

    const options = {
      fields: ['name', 'formatted_address', 'address_components', 'geometry'],
      types: ['address'], // optional: restrict to addresses only
    }

    const autoComplete = new window.google.maps.places.Autocomplete(inputRef.current, options)
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setPlaceAutocomplete(autoComplete)
  }, [placesAPI])

  // Listen for place changes
  useEffect(() => {
    if (!placeAutocomplete)
      return

    placeAutocomplete.addListener('place_changed', () => {
      const place = placeAutocomplete.getPlace()
      if (place.formatted_address) {
        // onChange(place.formatted_address) // update RHF value
        onPlaceChange?.(place) // run custom function to update associated RHF values
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeAutocomplete])

  // Prevent dialog close on autocomplete click
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('.pac-container')) {
        event.stopPropagation()
      }
    }
    document.addEventListener('click', handleClick, { capture: true })
    return () => document.removeEventListener('click', handleClick, { capture: true })
  }, [])

  return (
    <Input
      ref={inputRef}
      // onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  )
}
