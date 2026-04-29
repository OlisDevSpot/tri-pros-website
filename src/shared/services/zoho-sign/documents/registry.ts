import type { EnvelopeDocument, FieldSource } from './types'
import { format } from 'date-fns'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
import { pdfService } from '@/shared/services/pdf.service'
import { ZOHO_SIGN_TEMPLATES } from '../constants'

// --- Field source helpers -------------------------------------------------
//
// One pure-function resolver per Zoho field. Same instance reused across
// every template that has that field — Zoho merges field data globally
// per envelope (flat field_text_data), so identical labels across
// templates fill once.

const customerNameSrc: FieldSource = ctx => ctx.proposal.customer?.name ?? ''
const customerEmailSrc: FieldSource = ctx => ctx.proposal.customer?.email ?? ''
const customerPhoneSrc: FieldSource = ctx => ctx.proposal.customer?.phone ?? ''
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
const depositSrc: FieldSource = ctx => String(ctx.proposal.fundingJSON.data.depositAmount)

// Zoho per-template date format quirk: AWD's start-date / completion-date /
// original-contract-date are CustomDate fields with `MMM dd yyyy` validation;
// every template's sent-date is `MM/dd/yyyy`; base/senior start/completion
// are plain Textfield (accept any printable string). Use *ZohoSrc variants
// when targeting AWD CustomDate fields.
const startDateTextSrc: FieldSource = () => {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  return format(d, 'M/d/yyyy')
}

const completionDateTextSrc: FieldSource = (ctx) => {
  const days = Number(ctx.proposal.projectJSON.data.validThroughTimeframe.replace(/\D/g, ''))
  const d = new Date()
  d.setDate(d.getDate() + 3 + days)
  return format(d, 'M/d/yyyy')
}

const startDateZohoSrc: FieldSource = () => {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  return format(d, 'MMM dd yyyy')
}

const completionDateZohoSrc: FieldSource = (ctx) => {
  const days = Number(ctx.proposal.projectJSON.data.validThroughTimeframe.replace(/\D/g, ''))
  const d = new Date()
  d.setDate(d.getDate() + 3 + days)
  return format(d, 'MMM dd yyyy')
}

const sentDateSrc: FieldSource = () => format(new Date(), 'M/d/yyyy')

// AWD-only field — invariant: upsells run on a project that was created
// when a prior proposal was approved, so `originalContractDate` is always
// set. Throwing on null surfaces a real data integrity bug instead of
// silently shipping today's date as the original contract date.
const originalContractDateSrc: FieldSource = (ctx) => {
  if (!ctx.originalContractDate) {
    throw new Error('originalContractDate is null — upsell envelope on a project with no contract-sent proposal')
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

// --- Registry -------------------------------------------------------------
//
// Source of truth for which documents exist, when they apply, and how
// their fields are filled. Order in this array drives envelope assembly
// order: documents render in the merged Zoho envelope in the order
// listed below.
//
// ZOHO_SIGN_TEMPLATES lives in zoho-sign/constants — template IDs and
// per-template signer action IDs are versioned alongside the rest of
// the integration's constants.
//
// AWD (Additional Work Description) is upsell-only; pending user
// authoring it in Zoho. Future docs (credit-card-auth, finance-doc,
// finance-ack) appear in the enum but not yet in this registry —
// they're placeholders for incremental rollout.
//
// Fill `dateFieldMappings` for `sent-date` (CustomDate type — Zoho
// requires fields of type Date to fill via field_date_data, not
// field_text_data).

export const ENVELOPE_DOCUMENTS: readonly EnvelopeDocument[] = [
  {
    id: 'main-hi-base',
    label: 'Main HI agreement (non-senior)',
    source: { kind: 'zoho-template', zohoTemplateId: ZOHO_SIGN_TEMPLATES.base.templateId },
    applicableScenarios: ['initial'],
    perScenarioRules: {
      initial: { kind: 'required-when', predicate: ctx => !ctx.isSenior },
    },
    fieldMappings: {
      ...baseHomeownerFieldMappings,
      'ho-age': customerAgeSrc,
      'start-date': startDateTextSrc,
      'completion-date': completionDateTextSrc,
      'tcp': tcpSrc,
      'deposit': depositSrc,
      // sow-1 / sow-2 trimmed in Zoho UI 2026-04-28 — base / senior templates
      // no longer have those fields. SOW content lives in the attached
      // sow-pdf doc, not here.
    },
    signerActions: ZOHO_SIGN_TEMPLATES.base.actions,
  },
  {
    id: 'main-hi-senior',
    label: 'Main HI agreement (senior)',
    source: { kind: 'zoho-template', zohoTemplateId: ZOHO_SIGN_TEMPLATES.senior.templateId },
    applicableScenarios: ['initial'],
    perScenarioRules: {
      initial: { kind: 'required-when', predicate: ctx => ctx.isSenior },
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
      generator: ctx => pdfService.generateSowPdf({ proposalId: ctx.proposal.id }),
    },
    applicableScenarios: ['initial', 'upsell'],
    perScenarioRules: {
      // Initial: always generate the PDF (drops the short/long branch).
      initial: { kind: 'required' },
      // Upsell: only when SOW is too long to fit inline in AWD's sow-1/sow-2.
      upsell: { kind: 'required-when', predicate: ctx => ctx.isLongSow },
    },
  },
  {
    id: 'awd',
    label: 'Additional Work Description',
    source: { kind: 'zoho-template', zohoTemplateId: ZOHO_SIGN_TEMPLATES.awd.templateId },
    applicableScenarios: ['upsell'],
    perScenarioRules: {
      upsell: { kind: 'required' },
    },
    fieldMappings: {
      ...baseHomeownerFieldMappings,
      // `sow` is a single textfield meant for short-form upsell SOW only.
      // When isLongSow is true, sow-pdf is also required (separate doc in
      // the envelope) — leave AWD's sow blank so the page renders cleanly.
      'sow': ctx => ctx.isLongSow ? '' : ctx.sowText,
      // Signed dollar adjustment — positive when the addendum adds scope,
      // negative for credits/discounts. Today: maps to the upsell
      // proposal's finalTcp (which is the addendum's full amount). If
      // future requirements need explicit credits, add an override field
      // on the proposal entity and source from there.
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
    applicableScenarios: ['initial'],
    perScenarioRules: {
      initial: { kind: 'required-when', predicate: ctx => ctx.isSenior },
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
    applicableScenarios: ['initial'],
    perScenarioRules: {
      initial: { kind: 'required' },
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
    applicableScenarios: ['initial', 'upsell'],
    perScenarioRules: {
      initial: { kind: 'optional' },
      upsell: { kind: 'optional' },
    },
    fieldMappings: {
      ...baseHomeownerFieldMappings,
      // order-id, product-label, product-quantity not yet mapped — single-line-item
      // template today; agent fills via UI when toggling material-order on, OR we
      // mirror the customer's material list once that data model exists.
    },
    dateFieldMappings: {
      'sent-date': sentDateSrc,
    },
    signerActions: ZOHO_SIGN_TEMPLATES.materialOrder.actions,
  },
  // Future: credit-card-auth, finance-doc, finance-ack — added when authored in Zoho.
] as const

export { computeFinalTcp }
