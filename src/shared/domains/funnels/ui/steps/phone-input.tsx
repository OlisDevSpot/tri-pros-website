import type { ChangeEvent, Ref } from 'react'
import { Phone } from 'lucide-react'
import { Input } from '@/shared/components/ui/input'
import { formatPhoneAsYouType, toDigits } from '@/shared/lib/phone'
import { cn } from '@/shared/lib/utils'

/**
 * Masked US phone field for the funnel PII step. Drop-in for a react-hook-form
 * `field` ({ value, onChange, onBlur, name, ref }) inside `<FormControl>`.
 *
 * Behaviour:
 *  - Masks live to `(xxx) xxx-xxxx` via `formatPhoneAsYouType` (canonical home),
 *    which hard-caps at 10 national digits — extra characters are impossible.
 *  - Stores the FORMATTED string in the form; libphonenumber parses it fine, and
 *    the canonical 10-digit normalization still happens at the DB boundary.
 *  - Auto-blurs the moment the 10th digit lands, which both dismisses the mobile
 *    keyboard and fires the field's `onBlur` → the step's async phone validation
 *    (`mode: 'onBlur'`). Deferred a frame so React commits the value first.
 *
 * Visual: a leading phone glyph + `+1` affix, tabular figures and wide tracking
 * so the digits sit on an even rhythm and read as a "real" phone number.
 */
export function PhoneInput({ value, onChange, onBlur, name, ref, className }: {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  name?: string
  ref?: Ref<HTMLInputElement>
  className?: string
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const el = event.currentTarget
    const formatted = formatPhoneAsYouType(el.value)
    onChange(formatted)
    if (toDigits(formatted).length === 10) {
      // Defer so the controlled value is committed before focus leaves (RHF reads
      // the field value on blur to run the async validator).
      requestAnimationFrame(() => el.blur())
    }
  }

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center gap-1.5 text-sm font-medium"
      >
        <Phone className="size-4" />
        +1
      </span>
      <Input
        ref={ref}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="(555) 123-4567"
        maxLength={14}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        className={cn('pl-16 tracking-wide tabular-nums', className)}
      />
    </div>
  )
}
