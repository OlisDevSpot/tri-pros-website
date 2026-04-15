import type { Customer } from '@/shared/db/schema'
import type { CustomerFormValues } from '@/shared/entities/customers/types'

export function buildCustomerFormDefaults(customer: Customer): CustomerFormValues {
  return {
    name: customer.name ?? '',
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    address: customer.address ?? '',
    city: customer.city ?? '',
    state: customer.state ?? '',
    zip: customer.zip ?? '',
    customerProfileJSON: (customer.customerProfileJSON ?? {}) as CustomerFormValues['customerProfileJSON'],
    financialProfileJSON: (customer.financialProfileJSON ?? {}) as CustomerFormValues['financialProfileJSON'],
    propertyProfileJSON: (customer.propertyProfileJSON ?? {}) as CustomerFormValues['propertyProfileJSON'],
  }
}
