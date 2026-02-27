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

export function capitalize(roofType: string) {
  return roofType.charAt(0).toUpperCase() + roofType.slice(1).replace(/([A-Z])/g, ' $1')
}

export function numberToUSD(number: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(number)
}

export function formatAsDollars(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

export function formatAsPercent(value: number) {
  return `${value.toFixed(0)}%`
}

export function convertToNumber(value: string, startFormat: 'currency' | 'percent' = 'currency') {
  switch (startFormat) {
    case 'currency':
      return Number(value.replace(/\D/g, ''))
    case 'percent':
      return Number(value.replace(/%/g, ''))
  }
}

export function convertUTCToPST(date: Date | string) {
  const pstDate = new Date(date)
  pstDate.setHours(pstDate.getHours() - 8)
  return pstDate
}
