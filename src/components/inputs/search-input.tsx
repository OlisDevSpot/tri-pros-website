import { Search, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  placeholder?: string
  disabled?: boolean
  initialSearchTerm?: string
  onInputChange?: (val: string) => void
}

export function SearchInput({
  placeholder,
  disabled = false,
  onInputChange,
  className,
  ...props
}: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={cn('relative min-w-[100px]', className)} {...props}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        disabled={disabled}
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => {
          onInputChange?.(e.target.value)
          setSearchTerm(e.target.value)
        }}
        className="pl-10"
      />
      {searchTerm && (
        <X
          className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-muted-foreground/70 transition"
          onClick={() => {
            onInputChange?.('')
            setSearchTerm?.('')
            inputRef.current?.focus()
          }}
        />
      )}
    </div>
  )
}
