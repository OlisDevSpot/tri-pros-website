export const zohoRequestStatuses = [
  'draft',
  'inprogress',
  'completed',
  'declined',
  'recalled',
  'expired',
] as const
export type ZohoRequestStatus = (typeof zohoRequestStatuses)[number]

export const zohoActionStatuses = [
  'NOACTION',
  'UNOPENED',
  'VIEWED',
  'SIGNED',
] as const
export type ZohoActionStatus = (typeof zohoActionStatuses)[number]

export interface ZohoSignerStatus {
  role: string
  status: ZohoActionStatus
}

export interface ZohoContractStatus {
  requestId: string
  requestStatus: ZohoRequestStatus
  signerStatuses: ZohoSignerStatus[]
}
