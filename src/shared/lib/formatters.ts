export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatAsPhoneNumber(phone: string) {
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
}

export function formatAddress(address: string, city: string, state: string, zipCode: string) {
  return `${address}, 
  ${city}, ${state}, ${zipCode}`
}

export function formatStringAsDate(stringDate: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Date(stringDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'PST',
    hour: 'numeric',
    minute: 'numeric',
    ...options,
  })
}
