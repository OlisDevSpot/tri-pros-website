import { defineRules } from './define-rules'

/** The closed list of reasons a request runs with every permission. A new site adds its reason here first. */
export type SystemReason
  = | 'intake:form'
    | 'intake:funnel'
    | 'intake:landing'
    | 'webhook:bina'
    | 'webhook:justcall'
    | 'sync:quickbooks'
    | 'job:campaign-enrollment'
    | 'derived:new-lead-notification'
    | 'derived:customer-delete-cascade'
    | 'derived:meeting-reschedule'
    | 'derived:meeting-notification'
    | 'webhook:zoho-sign'
    | 'derived:proposal-sent'
    | 'derived:homeowner-age'
    | 'derived:envelope-documents'
    | 'derived:project-conversion'

export function systemRules(reason: SystemReason) {
  return defineRules((can) => {
    can('manage', 'all').because(reason)
  })
}
