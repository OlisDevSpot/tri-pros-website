import type { Control } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

interface Props {
  name: string
  label: string
  control: Control
}

export function SelectField({ control, name, label }: Props) {
  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Select defaultValue="all-cash">
              <SelectTrigger {...field} className="w-full">
                <SelectValue placeholder="Select a project type" />
              </SelectTrigger>
              <SelectContent {...field}>
                <SelectItem value="all-cash">
                  All Cash
                </SelectItem>
                <SelectItem value="all-finance">
                  All Finance
                </SelectItem>
                <SelectItem value="mixed">
                  Mixed
                </SelectItem>
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
