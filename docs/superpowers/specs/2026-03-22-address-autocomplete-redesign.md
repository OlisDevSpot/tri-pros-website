# Address Autocomplete Redesign — Spec

**Date:** 2026-03-22
**Status:** Approved
**Goal:** Replace the Google Places Autocomplete widget with a manual `AutocompleteService` implementation to gain control over API call frequency, enforce debounce + minimum character thresholds, use explicit session tokens, and unify two divergent address input components into one shared component.

---

## Problem

Two address autocomplete components exist with duplicated logic and different interfaces:

- `src/shared/components/inputs/address-input.tsx` — returns raw `PlaceResult`, no map preview, used by the landing general-inquiry form
- `src/features/intake/ui/components/address-autocomplete-field.tsx` — returns parsed `{ address, city, state, zip }`, includes a map preview, used by the intake form

Both use the legacy `google.maps.places.Autocomplete` widget, which:
- Makes its own API calls (no debounce control)
- Renders its own dropdown (`.pac-container`) outside React's control
- Cannot enforce a minimum character threshold before firing requests

## Solution

Switch to `google.maps.places.AutocompleteService` + `google.maps.places.PlacesService` for manual control. Build a unified `AddressAutocomplete` shared component with a custom predictions dropdown built on shadcn Popover + Command (cmdk).

---

## New Files

### 1. `src/shared/hooks/use-debounce.ts`

Generic debounce hook used by the autocomplete and available project-wide.

```ts
export function useDebounce<T>(value: T, delay: number): T
```

- Returns the input value after `delay` ms of inactivity
- Uses `useEffect` + `setTimeout` internally
- Cleans up pending timeouts on unmount

### 2. `src/shared/components/inputs/address-predictions-dropdown.tsx`

Controlled dropdown for displaying place predictions.

```ts
interface AddressPredictionsDropdownProps {
  predictions: google.maps.places.AutocompletePrediction[]
  isOpen: boolean
  onSelect: (placeId: string) => void
  isLoading?: boolean
  anchorRef: React.RefObject<HTMLDivElement | null>
}

export function AddressPredictionsDropdown(props: AddressPredictionsDropdownProps): React.ReactElement
```

**Implementation details:**
- Uses shadcn `Popover` (controlled, no trigger — open state driven by `isOpen` prop) + `PopoverContent` + `PopoverAnchor`
- `PopoverAnchor` wraps the parent input container via `anchorRef`
- Inside: `Command` + `CommandList` + `CommandItem` + `CommandEmpty`
- Each `CommandItem` renders:
  - `MapPinIcon` (lucide)
  - `prediction.structured_formatting.main_text` (bold)
  - `prediction.structured_formatting.secondary_text` (muted)
- `CommandEmpty` shows "No results found" or a loading spinner when `isLoading`
- `onSelect` fires with the `place_id` of the chosen prediction
- Keyboard navigation (up/down/enter) handled by cmdk automatically
- `PopoverContent` uses `onOpenAutoFocus={e => e.preventDefault()}` to keep focus in the input

### 3. `src/shared/components/inputs/address-autocomplete.tsx`

Main component — the only address input consumers need to use.

```ts
interface AddressFields {
  address: string
  city: string
  state: string
  zip: string
  fullAddress: string
  location?: { lat: number; lng: number }
}

interface AddressAutocompleteProps {
  onSelect: (fields: AddressFields) => void
  onClear?: () => void
  placeholder?: string
  disabled?: boolean
  showMap?: boolean       // default false
  debounceMs?: number     // default 300
  minChars?: number       // default 2
}

export function AddressAutocomplete(props: AddressAutocompleteProps): React.ReactElement
```

**Internal state:**
- `inputValue: string` — raw text from the input
- `predictions: AutocompletePrediction[]` — current predictions list
- `isLoading: boolean` — loading state for predictions fetch
- `isOpen: boolean` — dropdown open state
- `resolvedLoc: { lat, lng } | null` — resolved location for map preview
- `sessionToken: AutocompleteSessionToken` — ref, created on mount, regenerated after each selection

**Internal flow:**
1. User types → `inputValue` updates immediately (responsive input)
2. `useDebounce(inputValue, debounceMs)` produces `debouncedValue`
3. `useEffect` watches `debouncedValue`:
   - If `debouncedValue.length < minChars` → clear predictions, close dropdown
   - Otherwise → call `autocompleteService.getPlacePredictions({ input, sessionToken, componentRestrictions: { country: 'us' }, types: ['address'] })`
   - On success → set predictions, open dropdown
4. User selects a prediction (via `AddressPredictionsDropdown` `onSelect`):
   - Call `placesService.getDetails({ placeId, sessionToken, fields: ['address_components', 'formatted_address', 'geometry'] })`
   - Parse address components using helper functions (reuse logic from `google-maps-helpers.ts`)
   - Set `inputValue` to `formatted_address`, set `resolvedLoc` from geometry
   - Call `props.onSelect(parsedFields)`
   - Close dropdown, generate new session token
5. Clear button → reset all state, call `props.onClear?.()`

**Session token lifecycle:**
- Created on mount: `new google.maps.places.AutocompleteSessionToken()`
- Stored in `useRef` (not state — no re-render needed)
- Passed to every `getPlacePredictions` call
- Passed to `getDetails` on selection (bundles predictions + detail into one billed session)
- Regenerated after each completed selection

**UI structure:**
```
<div ref={anchorRef}>                    ← PopoverAnchor target
  <MapPinIcon />                         ← left icon
  <Input value={inputValue} ... />       ← controlled input
  {inputValue && <XIcon clear button />} ← conditional clear
</div>
{showMap && resolvedLoc && <Map ... />}  ← opt-in static map preview
<AddressPredictionsDropdown ... />       ← predictions popover
```

**Services initialization:**
- `useMapsLibrary('places')` from `@vis.gl/react-google-maps` to get the places library
- `AutocompleteService` and `PlacesService` instantiated in a `useEffect` when `placesLib` is available
- Stored in `useRef` — created once, reused

---

## Deleted Files

- `src/shared/components/inputs/address-input.tsx` — replaced by `AddressAutocomplete`
- `src/features/intake/ui/components/address-autocomplete-field.tsx` — replaced by `AddressAutocomplete`

## Modified Files

### `src/features/landing/ui/components/forms/general-inquiry-form.tsx`

- Replace `AddressInput` import with `AddressAutocomplete`
- Remove `extractPart` import and manual parsing — `AddressAutocomplete.onSelect` returns pre-parsed `AddressFields`
- The `APIProvider` wrapper stays (it's needed for `useMapsLibrary` inside `AddressAutocomplete`)
- Map `onSelect` fields to `form.setValue` calls:
  ```ts
  onSelect={({ address, city, state, zip, fullAddress, location }) => {
    form.setValue('address.street', address)
    form.setValue('address.city', city)
    form.setValue('address.state', state)
    form.setValue('address.zipCode', zip)
    form.setValue('address.fullAddress', fullAddress)
    form.setValue('address.location', location)
  }}
  ```

### `src/features/intake/ui/views/intake-form-view.tsx`

- Replace `AddressAutocompleteField` import with `AddressAutocomplete` from shared
- Add `showMap` prop
- `onSelect` and `onClear` callbacks match the existing shape — `onChange` maps to `onSelect`, field mapping stays the same

### `src/shared/lib/google-maps-helpers.ts`

- Add a new `parseAddressComponents` function that encapsulates the address parsing logic currently duplicated in `AddressAutocompleteField`. This function takes `google.maps.places.PlaceResult` and returns `AddressFields`.
- Keep existing `extractPart` function (may be used elsewhere).

---

## Cost Control Summary

| Mechanism | How it reduces cost |
|-----------|-------------------|
| **Session tokens** | Bundles all `getPlacePredictions` calls + the final `getDetails` call into one billed session (~$0.017) |
| **Debounce (300ms)** | Prevents firing on every keystroke — only fires after user pauses |
| **2-char minimum** | No API calls for single characters or empty input |
| **Google Cloud quota** | Daily request cap set in Cloud Console (the real guardrail) |

---

## Out of Scope

- Switching to Places API (New) — current implementation uses the legacy JS SDK which is what `@vis.gl/react-google-maps` provides
- Caching predictions across component instances
- Server-side Places API calls
