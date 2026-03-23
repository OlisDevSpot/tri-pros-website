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
      <PopoverAnchor virtualRef={anchorRef as React.RefObject<HTMLDivElement>} />
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
