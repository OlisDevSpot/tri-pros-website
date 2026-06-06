import { z } from 'zod'

import {
  ghlAppointmentEventTypes,
  ghlEventTypes,
  ghlNoteEventTypes,
  ghlOpportunityEventTypes,
} from './constants'

// ---------------------------------------------------------------------------
// Bina-specific payload (custom GHL workflow webhook)
// ---------------------------------------------------------------------------

export const binaAdditionalDataSchema = z.object({
  // Existing fields. GHL sends literal "null" strings for empties — coalesced
  // downstream by `ghlString` in the normalizer. Kept permissive (.optional()).
  budgetSolution: z.string().optional(),
  rebateAmount: z.string().optional(),
  trades: z.string().optional(),
  // Self-booking time → reused as leadMeta.scheduledFor (no new field).
  selfBookingDateTime: z.string().optional(),
  // Campaign-specific capture (energy-efficiency vs bathroom/kitchen). The
  // "master payload" carries whichever the running Bina campaign populated.
  bathroomAge: z.string().optional(),
  bathroomSize: z.string().optional(),
  bathroomScope: z.string().optional(),
  kitchenAge: z.string().optional(),
  kitchenSize: z.string().optional(),
  kitchenScope: z.string().optional(),
})

/**
 * Bina sends a custom GHL workflow webhook with flat contact fields at the top
 * level + nested additionalData object:
 *   { firstName, lastName, email, phone, address?, city, zip, additionalData: {...} }
 */
export const binaContactPayloadSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  address: z.string().optional(),
  city: z.string(),
  zip: z.string(),
  additionalData: binaAdditionalDataSchema,
})

// ---------------------------------------------------------------------------
// Standard GHL payloads (for future event types / 2-way sync)
// ---------------------------------------------------------------------------

const ghlCustomField = z.object({
  id: z.string(),
  value: z.unknown(),
})

export const ghlContactPayloadSchema = z.object({
  type: z.string(),
  locationId: z.string(),
  id: z.string(),
  address1: z.string().optional(),
  city: z.string().optional(),
  companyName: z.string().optional(),
  country: z.string().optional(),
  source: z.string().optional(),
  dateAdded: z.string().optional(),
  dateOfBirth: z.string().optional(),
  dnd: z.boolean().optional(),
  email: z.string().optional(),
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  postalCode: z.string().optional(),
  state: z.string().optional(),
  tags: z.array(z.string()).optional(),
  website: z.string().optional(),
  attachments: z.array(z.unknown()).optional(),
  assignedTo: z.string().optional(),
  customFields: z.array(ghlCustomField).optional(),
})

export const ghlAppointmentPayloadSchema = z.object({
  type: z.enum(ghlAppointmentEventTypes),
  locationId: z.string(),
  appointment: z.object({
    id: z.string(),
    address: z.string().optional(),
    title: z.string().optional(),
    calendarId: z.string().optional(),
    contactId: z.string().optional(),
    groupId: z.string().optional(),
    appointmentStatus: z.string().optional(),
    assignedUserId: z.string().optional(),
    users: z.array(z.string()).optional(),
    notes: z.string().optional(),
    source: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    dateAdded: z.string().optional(),
    dateUpdated: z.string().optional(),
  }),
})

export const ghlOpportunityPayloadSchema = z.object({
  type: z.enum(ghlOpportunityEventTypes),
  locationId: z.string(),
  id: z.string(),
  assignedTo: z.string().optional(),
  contactId: z.string().optional(),
  monetaryValue: z.number().optional(),
  name: z.string().optional(),
  pipelineId: z.string().optional(),
  pipelineStageId: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  dateAdded: z.string().optional(),
})

export const ghlNotePayloadSchema = z.object({
  type: z.enum(ghlNoteEventTypes),
  locationId: z.string(),
  id: z.string(),
  body: z.string().optional(),
  contactId: z.string().optional(),
  dateAdded: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Catch-all for event types we haven't modeled yet
// ---------------------------------------------------------------------------

export const ghlGenericPayloadSchema = z.object({
  type: z.enum(ghlEventTypes),
  locationId: z.string(),
}).passthrough()

// ---------------------------------------------------------------------------
// Discriminated union — Bina custom first, then standard GHL shapes
// ---------------------------------------------------------------------------

export const ghlWebhookPayloadSchema = z.union([
  binaContactPayloadSchema,
  ghlAppointmentPayloadSchema,
  ghlOpportunityPayloadSchema,
  ghlNotePayloadSchema,
  ghlGenericPayloadSchema,
])

// ---------------------------------------------------------------------------
// Minimal envelope — used for fast extraction before full validation
// ---------------------------------------------------------------------------

export const ghlEnvelopeSchema = z.object({
  type: z.string(),
}).passthrough()
