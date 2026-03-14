import { CircleUserIcon, MailIcon, MapPinIcon, PhoneIcon } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { formatAddress, formatAsPhoneNumber } from '@/shared/lib/formatters'

interface CustomerInfo {
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string
  state: string | null
  zip: string
}

interface Props {
  customer: CustomerInfo
}

export function CustomerInfoHeader({ customer }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs font-medium uppercase tracking-wider">
          Customer
        </Badge>
      </div>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <CircleUserIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="font-medium">{customer.name}</span>
        </div>
        {customer.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <PhoneIcon className="size-4 shrink-0" />
            <span>{formatAsPhoneNumber(customer.phone)}</span>
          </div>
        )}
        {customer.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MailIcon className="size-4 shrink-0" />
            <span>{customer.email}</span>
          </div>
        )}
        {customer.address && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPinIcon className="size-4 shrink-0" />
            <span>{formatAddress(customer.address, customer.city, customer.state ?? 'CA', customer.zip)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
