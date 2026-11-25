import type { Ref } from 'react'
import { Phone } from 'lucide-react'
import { useRef } from 'react'
import { PhoneField } from '@/shared/components/ui/phone-field'
import { cn } from '@/shared/lib/utils'

/**
 * The funnel PII step's phone field: the shared PhoneField mask plus a leading phone glyph and `+1`
 * affix. Auto-blurs the moment the 10th digit lands, which both dismisses the mobile keyboard and
 * fires the field's `onBlur` → the step's async phone validation (`mode: 'onBlur'`).
 */
export function PhoneInput({ value, onChange, onBlur, name, ref, className }: {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  name?: string
  ref?: Ref<HTMLInputElement>
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  function handleChange(digits: string) {
    onChange(digits)
    if (digits.length === 10) {
      // Defer so the controlled value is committed before focus leaves (RHF reads
      // the field value on blur to run the async validator).
      requestAnimationFrame(() => inputRef.current?.blur())
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
      <PhoneField
        ref={(el) => {
          inputRef.current = el
          if (typeof ref === 'function') {
            ref(el)
          }
          else if (ref) {
            ref.current = el
          }
        }}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        className={cn('pl-16 tracking-wide', className)}
      />
    </div>
  )
}
