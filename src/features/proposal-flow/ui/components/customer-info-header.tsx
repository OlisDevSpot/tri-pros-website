import { CircleUserIcon } from 'lucide-react'
import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { EmailAction } from '@/shared/components/contact-actions/ui/email-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { Badge } from '@/shared/components/ui/badge'
import { formatAddress } from '@/shared/lib/formatters'

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
          <PhoneAction
            className="text-muted-foreground"
            phone={customer.phone}
          />
        )}
        {customer.email && (
          <EmailAction
            className="text-muted-foreground"
            email={customer.email}
          />
        )}
        {customer.address && (
          <AddressAction
            address={formatAddress(customer.address, customer.city, customer.state ?? 'CA', customer.zip)}
            className="text-muted-foreground"
          />
        )}
      </div>
    </div>
  )
}
