import type { EnvelopeDocument, FieldSource } from './types'
import { format } from 'date-fns'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { formatPhone } from '@/shared/lib/phone'
import { cslbEarliestStartDate } from '@/shared/modules/proposals/core/lib/cslb-start-date'
import { computeFinalTcp } from '@/shared/modules/proposals/core/lib/financials'
import { pdfService } from '@/shared/services/pdf.service'
import { ZOHO_SIGN_TEMPLATES } from '../../constants'

// Zoho merges field data per envelope (flat field_text_data), so identical labels across templates fill once.

const customerNameSrc: FieldSource = ctx => ctx.proposal.customer?.name ?? ''
const customerEmailSrc: FieldSource = ctx => ctx.proposal.customer?.email ?? ''
const customerPhoneSrc: FieldSource = ctx => formatPhone(ctx.proposal.customer?.phone)
const customerAddressSrc: FieldSource = ctx => ctx.proposal.customer?.address ?? ''
const customerCityStateZipSrc: FieldSource = (ctx) => {
  const c = ctx.proposal.customer
  if (!c) {
    return ''
  }
  return `${c.city}, ${c.state ?? 'CA'} ${c.zip}`
}
const customerAgeSrc: FieldSource = ctx => String(ctx.proposal.customer?.customerAge ?? '')

const tcpSrc: FieldSource = ctx => String(ctx.finalTcp)
const depositSrc: FieldSource = ctx => String((ctx.proposal.depositAmountCents ?? 0) / 100)

// AWD's start/completion/original-contract dates are Zoho CustomDate fields validated as `MMM dd yyyy`; base/senior dates are plain text — use the *ZohoSrc variants for AWD.
// Start date = earliest legal start under CSLB (3- or 5-business-day rescission, Cal. Civil Code §1689.6/.7) — never a naive today + N days.
const startDateTextSrc: FieldSource = (ctx) => {
  return format(cslbEarliestStartDate(new Date(), ctx.isSenior), 'M/d/yyyy')
}

const completionDateTextSrc: FieldSource = (ctx) => {
  const days = Number(ctx.proposal.projectJSON.data.validThroughTimeframe.replace(/\D/g, ''))
  const d = cslbEarliestStartDate(new Date(), ctx.isSenior)
  d.setDate(d.getDate() + days)
  return format(d, 'M/d/yyyy')
}

const startDateZohoSrc: FieldSource = (ctx) => {
  return format(cslbEarliestStartDate(new Date(), ctx.isSenior), 'MMM dd yyyy')
}

const completionDateZohoSrc: FieldSource = (ctx) => {
  const days = Number(ctx.proposal.projectJSON.data.validThroughTimeframe.replace(/\D/g, ''))
  const d = cslbEarliestStartDate(new Date(), ctx.isSenior)
  d.setDate(d.getDate() + days)
  return format(d, 'MMM dd yyyy')
}

const sentDateSrc: FieldSource = () => format(new Date(), 'M/d/yyyy')

const originalContractDateSrc: FieldSource = (ctx) => {
  if (!ctx.originalContractDate) {
    console.warn('originalContractDate is null on additional-work envelope — falling back to today; project likely has zero proposals')
    return format(new Date(), 'MMM dd yyyy')
  }
  return format(ctx.originalContractDate, 'MMM dd yyyy')
}

const baseHomeownerFieldMappings: Record<string, FieldSource> = {
  'ho-name': customerNameSrc,
  'ho-email': customerEmailSrc,
  'ho-phone': customerPhoneSrc,
  'ho-address': customerAddressSrc,
  'ho-city-state-zip': customerCityStateZipSrc,
}

// Array order = document order in the merged Zoho envelope.
// Zoho fills Date-type fields via field_date_data, not field_text_data — those belong in `dateFieldMappings`.

export const ENVELOPE_DOCUMENTS: readonly EnvelopeDocument[] = [
  {
    id: 'main-hi-base',
    label: 'Main HI agreement (non-senior)',
    source: { kind: 'zoho-template', zohoTemplateId: ZOHO_SIGN_TEMPLATES.base.templateId },
    applicableKinds: ['initial-sale'],
    perKindRules: {
      'initial-sale': { kind: 'required-when', predicate: ctx => !ctx.isSenior },
    },
    fieldMappings: {
      ...baseHomeownerFieldMappings,
      'ho-age': customerAgeSrc,
      'start-date': startDateTextSrc,
      'completion-date': completionDateTextSrc,
      'tcp': tcpSrc,
      'deposit': depositSrc,
    },
    signerActions: ZOHO_SIGN_TEMPLATES.base.actions,
  },
  {
    id: 'main-hi-senior',
    label: 'Main HI agreement (senior)',
    source: { kind: 'zoho-template', zohoTemplateId: ZOHO_SIGN_TEMPLATES.senior.templateId },
    applicableKinds: ['initial-sale'],
    perKindRules: {
      'initial-sale': { kind: 'required-when', predicate: ctx => ctx.isSenior },
    },
    fieldMappings: {
      ...baseHomeownerFieldMappings,
      'ho-age': customerAgeSrc,
      'start-date': startDateTextSrc,
      'completion-date': completionDateTextSrc,
      'tcp': tcpSrc,
      'deposit': depositSrc,
    },
    signerActions: ZOHO_SIGN_TEMPLATES.senior.actions,
  },
  {
    id: 'sow-pdf',
    label: 'Scope of Work',
    source: {
      kind: 'generated-pdf',
      generator: ctx => pdfService.generateSowPdf(SYSTEM_CONTEXT, { proposalId: ctx.proposal.id }),
    },
    applicableKinds: ['initial-sale', 'additional-work'],
    perKindRules: {
      'initial-sale': { kind: 'required' },
      'additional-work': { kind: 'required-when', predicate: ctx => ctx.isLongSow },
    },
  },
  {
    id: 'awd',
    label: 'Additional Work Description',
    source: { kind: 'zoho-template', zohoTemplateId: ZOHO_SIGN_TEMPLATES.awd.templateId },
    applicableKinds: ['additional-work'],
    perKindRules: {
      'additional-work': { kind: 'required' },
    },
    fieldMappings: {
      ...baseHomeownerFieldMappings,
      // A long SOW ships as the sow-pdf doc instead; AWD's single `sow` field stays blank so the page renders cleanly.
      'sow': ctx => ctx.isLongSow ? '' : ctx.sowText,
      // Zoho's price-adjustment is a signed amount (negative = credit); today it is always the addendum's full finalTcp.
      'price-adjustment': tcpSrc,
    },
    dateFieldMappings: {
      'sent-date': sentDateSrc,
      'start-date': startDateZohoSrc,
      'completion-date': completionDateZohoSrc,
      'original-contract-date': originalContractDateSrc,
    },
    signerActions: ZOHO_SIGN_TEMPLATES.awd.actions,
  },
  {
    id: 'senior-ack',
    label: 'Senior citizen acknowledgement',
    source: { kind: 'zoho-template', zohoTemplateId: ZOHO_SIGN_TEMPLATES.seniorAck.templateId },
    applicableKinds: ['initial-sale'],
    perKindRules: {
      'initial-sale': { kind: 'required-when', predicate: ctx => ctx.isSenior },
    },
    fieldMappings: {
      ...baseHomeownerFieldMappings,
      'ho-age': customerAgeSrc,
    },
    dateFieldMappings: {
      'sent-date': sentDateSrc,
    },
    signerActions: ZOHO_SIGN_TEMPLATES.seniorAck.actions,
  },
  {
    id: 'esign-waiver',
    label: 'E-sign waiver',
    source: { kind: 'zoho-template', zohoTemplateId: ZOHO_SIGN_TEMPLATES.esignWaiver.templateId },
    applicableKinds: ['initial-sale'],
    perKindRules: {
      'initial-sale': { kind: 'required' },
    },
    fieldMappings: {
      ...baseHomeownerFieldMappings,
    },
    dateFieldMappings: {
      'sent-date': sentDateSrc,
    },
    signerActions: ZOHO_SIGN_TEMPLATES.esignWaiver.actions,
  },
  {
    id: 'material-order',
    label: 'Material order',
    source: { kind: 'zoho-template', zohoTemplateId: ZOHO_SIGN_TEMPLATES.materialOrder.templateId },
    applicableKinds: ['initial-sale', 'additional-work'],
    perKindRules: {
      'initial-sale': { kind: 'optional' },
      'additional-work': { kind: 'optional' },
    },
    fieldMappings: {
      ...baseHomeownerFieldMappings,
      // order-id / product-label / product-quantity are not mapped yet — the agent fills them in the Zoho UI.
    },
    dateFieldMappings: {
      'sent-date': sentDateSrc,
    },
    signerActions: ZOHO_SIGN_TEMPLATES.materialOrder.actions,
  },
  // Future: credit-card-auth, finance-doc, finance-ack — added when authored in Zoho.
] as const

export { computeFinalTcp }
