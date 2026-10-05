'use client'

import type { PricingKey } from '@/features/calculators/scope-pricing-calculator/constants/pricing-keys'

import { PlusIcon } from 'lucide-react'
import { useState } from 'react'

import { FORMULA_GROUPS } from '@/features/calculators/scope-pricing-calculator/lib/formula-registry'
import { Button } from '@/shared/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/shared/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

interface Props {
  onAddFormula: (pricingKey: PricingKey) => void
  onAddManual: () => void
}

export function AddScopePicker({ onAddFormula, onAddManual }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button className="h-11 self-start" type="button" variant="outline">
          <PlusIcon />
          Add scope
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search scopes" />
          <CommandList>
            <CommandEmpty>No scope matches.</CommandEmpty>
            {FORMULA_GROUPS.map(group => (
              <CommandGroup heading={group.label} key={group.trade}>
                {group.formulas.map(formula => (
                  <CommandItem
                    className="min-h-11"
                    key={formula.key}
                    onSelect={() => {
                      onAddFormula(formula.key)
                      setOpen(false)
                    }}
                    value={`${group.label} ${formula.label}`}
                  >
                    {formula.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                className="min-h-11"
                onSelect={() => {
                  onAddManual()
                  setOpen(false)
                }}
                value="Manual price line"
              >
                Manual price line
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
