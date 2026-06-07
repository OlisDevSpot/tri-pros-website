interface LeadLocationParts {
  address?: string | null
  city: string
  state?: string | null
  zip: string
}

export interface FormattedLeadLocation {
  /** Street address line — null when the lead has no street address. */
  street: string | null
  /** Always present: "City, ST 92805". */
  cityLine: string
}

export function formatLeadLocation(parts: LeadLocationParts): FormattedLeadLocation {
  const street = parts.address?.trim() ? parts.address.trim() : null
  const state = parts.state?.trim() ? `, ${parts.state.trim()}` : ''
  const cityLine = `${parts.city}${state} ${parts.zip}`.trim()
  return { street, cityLine }
}
