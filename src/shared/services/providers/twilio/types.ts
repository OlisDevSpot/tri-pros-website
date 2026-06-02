// Re-exports of the SDK's typed resource shapes. Callers in Slug C's
// services should import from here, not directly from `twilio/lib/...`,
// so the provider remains the single boundary that knows the SDK.

export { RestException } from './client'

export type {
  CallInstance,
  CallListInstanceCreateOptions,
} from 'twilio/lib/rest/api/v2010/account/call'
export type {
  IncomingPhoneNumberInstance,
  IncomingPhoneNumberListInstanceOptions,
} from 'twilio/lib/rest/api/v2010/account/incomingPhoneNumber'
export type {
  MessageInstance,
  MessageListInstanceCreateOptions,
} from 'twilio/lib/rest/api/v2010/account/message'
