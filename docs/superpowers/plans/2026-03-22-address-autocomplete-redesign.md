# Address Autocomplete Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Google Places Autocomplete widget with a manual `AutocompleteService` implementation, unifying two address input components into a single shared component with debounce, 2-char minimum, and session tokens.

**Architecture:** A shared `AddressAutocomplete` component uses `AutocompleteService` for manual API control, `useDebounce` for rate limiting, and a `Popover + Command` dropdown for predictions. Consumers pass `onSelect` to receive parsed address fields. The component is schema-agnostic — consumers map generic field names to their own form schemas.

**Tech Stack:** React 19, Next.js 15, TypeScript, `@vis.gl/react-google-maps`, shadcn/ui (Popover + Command/cmdk), Tailwind v4, react-hook-form, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-22-address-autocomplete-redesign.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/shared/hooks/use-debounce.ts` | Generic debounce hook |
| Create | `src/shared/components/inputs/address-predictions-dropdown.tsx` | Popover + Command dropdown for predictions |
| Create | `src/shared/components/inputs/address-autocomplete.tsx` | Main autocomplete component with AutocompleteService |
| Modify | `src/shared/lib/google-maps-helpers.ts` | Add `parseAddressComponents` function |
| Modify | `src/features/intake/ui/views/intake-form-view.tsx` | Swap to `AddressAutocomplete` |
| Modify | `src/features/landing/ui/components/forms/general-inquiry-form.tsx` | Swap to `AddressAutocomplete`, hoist `APIProvider` |
| Modify | `src/shared/components/dialogs/modals/base-modal.tsx` | Remove `.pac-container` workaround |
| Delete | `src/shared/components/inputs/address-input.tsx` | Old widget-based component |
| Delete | `src/features/intake/ui/components/address-autocomplete-field.tsx` | Old widget-based component |

---

## Task 1: Create `useDebounce` hook

**Files:**
- Create: `src/shared/hooks/use-debounce.ts`

- [ ] **Step 1: Create the hook**

```ts
// src/shared/hooks/use-debounce.ts
import { useEffect, useState } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
```

- [ ] **Step 2: Verify lint passes**

Run: `pnpm lint --quiet`
Expected: No errors related to `use-debounce.ts`

- [ ] **Step 3: Commit**

```bash
git add src/shared/hooks/use-debounce.ts
git commit -m "feat: add generic useDebounce hook"
```

---

## Task 2: Add `parseAddressComponents` to google-maps-helpers

**Files:**
- Modify: `src/shared/lib/google-maps-helpers.ts`

**Context:** This file already has `extractPart` and `getCityName`. We add `parseAddressComponents` which uses `getCityName` for the LA neighborhood logic and returns the `AddressFields` shape.

- [ ] **Step 1: Add the function**

Append to the bottom of `src/shared/lib/google-maps-helpers.ts`:

```ts
export interface AddressFields {
  address: string
  city: string
  state: string
  zip: string
  fullAddress: string
  location: { lat: number; lng: number } | null
}

export function parseAddressComponents(place: google.maps.places.PlaceResult): AddressFields {
  const components = place.address_components ?? []

  const get = (type: string) =>
    components.find(c => c.types.includes(type))?.long_name ?? ''
  const getShort = (type: string) =>
    components.find(c => c.types.includes(type))?.short_name ?? ''

  const streetNumber = get('street_number')
  const route = get('route')
  const address = [streetNumber, route].filter(Boolean).join(' ')
  const city = getCityName(components)
  const state = getShort('administrative_area_level_1')
  const zip = get('postal_code')
  const fullAddress = place.formatted_address ?? [address, city, state].filter(Boolean).join(', ')
  const location = place.geometry?.location
    ? { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }
    : null

  return { address, city, state, zip, fullAddress, location }
}
```

Note: `getCityName` is already defined in this file (private function). It handles the Los Angeles neighborhood fallback.

- [ ] **Step 2: Verify lint passes**

Run: `pnpm lint --quiet`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/shared/lib/google-maps-helpers.ts
git commit -m "feat: add parseAddressComponents to google-maps-helpers"
```

---

## Task 3: Create `AddressPredictionsDropdown` component

**Files:**
- Create: `src/shared/components/inputs/address-predictions-dropdown.tsx`

**Context:** Uses shadcn `Popover` (from `@/shared/components/ui/popover`) and `Command` (from `@/shared/components/ui/command`). The popover is controlled — no `PopoverTrigger`, uses `PopoverAnchor` instead. Focus stays in the external input.

- [ ] **Step 1: Create the component**

```tsx
// src/shared/components/inputs/address-predictions-dropdown.tsx
'use client'

import { LoaderCircleIcon, MapPinIcon } from 'lucide-react'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/shared/components/ui/command'
import { Popover, PopoverAnchor, PopoverContent } from '@/shared/components/ui/popover'

interface AddressPredictionsDropdownProps {
  predictions: google.maps.places.AutocompletePrediction[]
  isOpen: boolean
  onSelect: (placeId: string) => void
  isLoading?: boolean
  anchorRef: React.RefObject<HTMLDivElement | null>
}

const LISTBOX_ID = 'address-predictions-listbox'

export { LISTBOX_ID as ADDRESS_PREDICTIONS_LISTBOX_ID }

export function AddressPredictionsDropdown({
  predictions,
  isOpen,
  onSelect,
  isLoading = false,
  anchorRef,
}: AddressPredictionsDropdownProps) {
  return (
    <Popover open={isOpen}>
      <PopoverAnchor virtualRef={anchorRef} />
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={e => e.preventDefault()}
        onCloseAutoFocus={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList id={LISTBOX_ID}>
            {isLoading && predictions.length === 0 && (
              <CommandEmpty>
                <LoaderCircleIcon className="mx-auto size-4 animate-spin text-muted-foreground" />
              </CommandEmpty>
            )}
            {!isLoading && predictions.length === 0 && (
              <CommandEmpty>No results found</CommandEmpty>
            )}
            {predictions.length > 0 && (
              <CommandGroup>
                {predictions.map(prediction => (
                  <CommandItem
                    key={prediction.place_id}
                    value={prediction.place_id}
                    onSelect={() => onSelect(prediction.place_id)}
                  >
                    <MapPinIcon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {prediction.structured_formatting.main_text}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {prediction.structured_formatting.secondary_text}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Verify lint passes**

Run: `pnpm lint --quiet`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/inputs/address-predictions-dropdown.tsx
git commit -m "feat: add AddressPredictionsDropdown with Popover + Command"
```

---

## Task 4: Create `AddressAutocomplete` component

**Files:**
- Create: `src/shared/components/inputs/address-autocomplete.tsx`

**Context:** This is the main component. It uses:
- `useMapsLibrary('places')` from `@vis.gl/react-google-maps` (requires `APIProvider` ancestor)
- `useDebounce` from `@/shared/hooks/use-debounce`
- `parseAddressComponents` and `AddressFields` from `@/shared/lib/google-maps-helpers`
- `AddressPredictionsDropdown` and `ADDRESS_PREDICTIONS_LISTBOX_ID` from `./address-predictions-dropdown`
- shadcn `Input`, `Button` from `@/shared/components/ui/`
- `Map` from `@vis.gl/react-google-maps` (for opt-in map preview)

- [ ] **Step 1: Create the component**

```tsx
// src/shared/components/inputs/address-autocomplete.tsx
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
  const [resolvedLoc, setResolvedLoc] = useState<{ lat: number; lng: number } | null>(null)

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
```

- [ ] **Step 2: Verify lint passes**

Run: `pnpm lint --quiet`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/inputs/address-autocomplete.tsx
git commit -m "feat: add AddressAutocomplete with AutocompleteService, debounce, session tokens"
```

---

## Task 5: Update intake form consumer

**Files:**
- Modify: `src/features/intake/ui/views/intake-form-view.tsx`

**Context:** Currently imports `AddressAutocompleteField` from `@/features/intake/ui/components/address-autocomplete-field`. Replace with `AddressAutocomplete` from shared. The intake form uses flat field names (`address`, `city`, `state`, `zip`) which match `AddressFields` exactly. Add `showMap` prop. The `APIProvider` already wraps the entire form in this file — no hoisting needed.

- [ ] **Step 1: Update the import**

Replace:
```ts
import { AddressAutocompleteField } from '@/features/intake/ui/components/address-autocomplete-field'
```
With:
```ts
import { AddressAutocomplete } from '@/shared/components/inputs/address-autocomplete'
```

- [ ] **Step 2: Update the component usage**

Replace the `<AddressAutocompleteField ... />` block (approx lines 158-171):
```tsx
<AddressAutocomplete
  showMap
  onSelect={(fields) => {
    form.setValue('address', fields.address)
    form.setValue('city', fields.city)
    form.setValue('state', fields.state)
    form.setValue('zip', fields.zip)
  }}
  onClear={() => {
    form.setValue('address', '')
    form.setValue('city', '')
    form.setValue('state', '')
    form.setValue('zip', '')
  }}
/>
```

- [ ] **Step 3: Verify lint passes**

Run: `pnpm lint --quiet`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/features/intake/ui/views/intake-form-view.tsx
git commit -m "refactor(intake): swap AddressAutocompleteField for shared AddressAutocomplete"
```

---

## Task 6: Update general-inquiry form consumer

**Files:**
- Modify: `src/features/landing/ui/components/forms/general-inquiry-form.tsx`

**Context:** Currently imports `AddressInput` from shared and `extractPart` from `google-maps-helpers`. The `APIProvider` wraps only the address `FormControl` — it must be hoisted to wrap the form. The general-inquiry form uses nested field names (`address.street`, `address.city`, `address.state`, `address.zipCode`, `address.fullAddress`, `address.location`).

- [ ] **Step 1: Update imports**

Remove:
```ts
import { AddressInput } from '@/shared/components/inputs/address-input'
import { extractPart } from '@/shared/lib/google-maps-helpers'
```

Add:
```ts
import { AddressAutocomplete } from '@/shared/components/inputs/address-autocomplete'
```

- [ ] **Step 2: Hoist `APIProvider` to wrap the entire form**

Move the `<APIProvider apiKey={...}>` from inside the address `FormControl` to wrap the outermost `<Form>`:

```tsx
return (
  {/* eslint-disable-next-line node/prefer-global/process */}
  <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
    <Form {...form}>
      {/* ... rest of form unchanged ... */}
    </Form>
  </APIProvider>
)
```

Remove the `<APIProvider>` that currently wraps only the `<AddressInput>` inside the address FormField.

- [ ] **Step 3: Replace the address field render**

Replace the address `<FormField>` render content (approx lines 101-135). The new render:

```tsx
<FormField
  control={form.control}
  name="address"
  render={() => (
    <FormItem>
      <FormLabel>Address</FormLabel>
      <AddressAutocomplete
        onSelect={({ address, city, state, zip, fullAddress, location }) => {
          form.setValue('address.street', address)
          form.setValue('address.city', city)
          form.setValue('address.state', state)
          form.setValue('address.zipCode', zip)
          form.setValue('address.fullAddress', fullAddress)
          form.setValue('address.location', location)
        }}
      />
      <FormMessage />
    </FormItem>
  )}
/>
```

- [ ] **Step 4: Verify lint passes**

Run: `pnpm lint --quiet`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/features/landing/ui/components/forms/general-inquiry-form.tsx
git commit -m "refactor(landing): swap AddressInput for shared AddressAutocomplete, hoist APIProvider"
```

---

## Task 7: Remove dead `.pac-container` workaround from base-modal

**Files:**
- Modify: `src/shared/components/dialogs/modals/base-modal.tsx`

**Context:** The `onInteractOutside` handler on `DialogContent` (lines 37-45) checks for `.pac-container` to prevent the dialog from closing when clicking the old Google Places widget dropdown. This is now dead code since the widget is gone.

- [ ] **Step 1: Remove the `onInteractOutside` prop**

Remove the entire `onInteractOutside` prop from `<DialogContent>` (lines 37-45):

```tsx
// REMOVE THIS:
onInteractOutside={(event) => {
  // Prevent closing when clicking Google Places dropdown
  if (
    event.target instanceof HTMLElement
    && event.target.closest('.pac-container')
  ) {
    event.preventDefault()
  }
}}
```

- [ ] **Step 2: Verify lint passes**

Run: `pnpm lint --quiet`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/dialogs/modals/base-modal.tsx
git commit -m "cleanup: remove dead .pac-container workaround from base-modal"
```

---

## Task 8: Delete old address input components

**Files:**
- Delete: `src/shared/components/inputs/address-input.tsx`
- Delete: `src/features/intake/ui/components/address-autocomplete-field.tsx`

- [ ] **Step 1: Verify no remaining imports of old components**

Run:
```bash
grep -r "address-input\|AddressInput\|address-autocomplete-field\|AddressAutocompleteField" src/ --include="*.ts" --include="*.tsx" | grep -v "address-autocomplete.tsx\|node_modules"
```
Expected: No results (all consumers already updated in tasks 5-6)

- [ ] **Step 2: Delete the files**

```bash
rm src/shared/components/inputs/address-input.tsx
rm src/features/intake/ui/components/address-autocomplete-field.tsx
```

- [ ] **Step 3: Verify build passes**

Run: `pnpm lint --quiet`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -u src/shared/components/inputs/address-input.tsx src/features/intake/ui/components/address-autocomplete-field.tsx
git commit -m "cleanup: delete old AddressInput and AddressAutocompleteField components"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run full lint**

Run: `pnpm lint`
Expected: No errors

- [ ] **Step 2: Run typecheck**

Run: `pnpm build`
Expected: Build succeeds. This verifies types, imports, and that no dead references remain.

- [ ] **Step 3: Manual smoke test**

Start dev server (`pnpm dev`) and test:
1. Navigate to intake form — type an address, verify dropdown appears after 2+ chars, select a prediction, verify fields populate and map shows
2. Navigate to general-inquiry form — same test, verify fields populate (no map)
3. Verify clear button resets the input and map
4. Verify keyboard navigation works in dropdown (up/down/enter)

- [ ] **Step 4: Commit any fixes from smoke test**

If any fixes were needed, commit them:
```bash
git commit -m "fix: address autocomplete smoke test fixes"
```
