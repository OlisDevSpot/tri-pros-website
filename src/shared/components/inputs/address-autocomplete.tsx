'use client'

import type { AddressFields } from '@/shared/lib/google-maps-helpers'
import { Map, useMapsLibrary } from '@vis.gl/react-google-maps'
import { MapPinIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { parseAddressComponents } from '@/shared/lib/google-maps-helpers'
import {
  ADDRESS_PREDICTIONS_LISTBOX_ID,
  AddressPredictionsDropdown,
} from './address-predictions-dropdown'

export type { AddressFields } from '@/shared/lib/google-maps-helpers'

interface AddressAutocompleteProps {
  onSelect: (fields: AddressFields) => void
  onClear?: () => void
  defaultValue?: string
  placeholder?: string
  disabled?: boolean
  showMap?: boolean
  debounceMs?: number
  minChars?: number
}

export function AddressAutocomplete({
  onSelect,
  onClear,
  defaultValue = '',
  placeholder = 'Start typing an address\u2026',
  disabled = false,
  showMap = false,
  debounceMs = 300,
  minChars = 2,
}: AddressAutocompleteProps) {
  const placesLib = useMapsLibrary('places')

  // Services — created once when placesLib loads
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null)
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  // Dummy div for PlacesService (requires an HTMLDivElement)
  const placesServiceDivRef = useRef<HTMLDivElement | null>(null)

  // State
  const [inputValue, setInputValue] = useState(defaultValue)
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [resolvedLoc, setResolvedLoc] = useState<{ lat: number, lng: number } | null>(null)

  // Popover anchor
  const anchorRef = useRef<HTMLDivElement | null>(null)

  const debouncedValue = useDebounce(inputValue, debounceMs)

  // Initialize services
  useEffect(() => {
    if (!placesLib) {
      return
    }
    autocompleteServiceRef.current = new placesLib.AutocompleteService()
    // PlacesService needs a DOM element (attributions container)
    if (!placesServiceDivRef.current) {
      placesServiceDivRef.current = document.createElement('div')
    }
    placesServiceRef.current = new placesLib.PlacesService(placesServiceDivRef.current)
    sessionTokenRef.current = new placesLib.AutocompleteSessionToken()
  }, [placesLib])

  // Fetch predictions when debounced value changes
  useEffect(() => {
    const service = autocompleteServiceRef.current
    if (!service || !sessionTokenRef.current) {
      return
    }

    if (debouncedValue.length < minChars) {
      setPredictions([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    service.getPlacePredictions(
      {
        input: debouncedValue,
        sessionToken: sessionTokenRef.current,
        componentRestrictions: { country: 'us' },
        types: ['address'],
      },
      (results, status) => {
        setIsLoading(false)
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(results)
          setIsOpen(true)
        }
        else {
          setPredictions([])
          setIsOpen(false)
        }
      },
    )
  }, [debouncedValue, minChars])

  // Handle prediction selection
  const handleSelect = useCallback(
    (placeId: string) => {
      const service = placesServiceRef.current
      if (!service || !sessionTokenRef.current || !placesLib) {
        return
      }

      service.getDetails(
        {
          placeId,
          sessionToken: sessionTokenRef.current,
          fields: ['address_components', 'formatted_address', 'geometry'],
        },
        (place, status) => {
          // Regenerate session token regardless of outcome
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken()

          if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
            setIsOpen(false)
            return
          }

          const parsed = parseAddressComponents(place)
          setInputValue(parsed.fullAddress)
          setResolvedLoc(parsed.location)
          setPredictions([])
          setIsOpen(false)
          onSelect(parsed)
        },
      )
    },
    [onSelect, placesLib],
  )

  function handleClear() {
    setInputValue('')
    setPredictions([])
    setIsOpen(false)
    setResolvedLoc(null)
    onClear?.()
  }

  return (
    <div className="flex flex-col gap-2">
      <div ref={anchorRef} className="relative">
        <MapPinIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={ADDRESS_PREDICTIONS_LISTBOX_ID}
          aria-autocomplete="list"
          className="pl-8 pr-8"
          placeholder={placeholder}
          disabled={disabled}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
        />
        {inputValue && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="absolute right-1 top-1/2 size-6 -translate-y-1/2"
            onClick={handleClear}
          >
            <XIcon className="size-3" />
          </Button>
        )}
      </div>

      <AddressPredictionsDropdown
        predictions={predictions}
        isOpen={isOpen}
        onSelect={handleSelect}
        isLoading={isLoading}
        anchorRef={anchorRef}
      />

      {showMap && resolvedLoc && (
        <div className="h-50 overflow-hidden rounded-lg border border-border md:h-60">
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
