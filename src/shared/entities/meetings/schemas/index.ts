import z from 'zod'
import {
  budgetComforts,
  demeanors,
  spouseDynamics,
} from '@/shared/constants/enums/customers'
import { meetingDecisionMakersPresentOptions } from '@/shared/constants/enums/meetings'

// ── Context Panel Schema (replaces situationProfileSchema) ──────────────────

export const meetingContextSchema = z.object({
  // Situational
  decisionMakersPresent: z.enum(meetingDecisionMakersPresentOptions),
  // During-meeting observations
  observedUrgency: z.number().int().min(1).max(10),
  observedBudgetComfort: z.enum(budgetComforts),
  spouseDynamic: z.enum(spouseDynamics),
  customerDemeanor: z.enum(demeanors),
}).partial()

export type MeetingContext = z.infer<typeof meetingContextSchema>

// ── Flow State Schema (replaces programDataSchema + meetingScopesSchema) ─────

export const tradeSelectionSchema = z.object({
  tradeId: z.string(),
  tradeName: z.string(),
  selectedScopes: z.array(z.object({ id: z.string(), label: z.string() })),
  painPoints: z.array(z.string()),
  notes: z.string().optional(),
})

export type TradeSelection = z.infer<typeof tradeSelectionSchema>

export const dealStructureIncentiveSchema = z.object({
  label: z.string(),
  amount: z.number(),
  source: z.string(),
})

export type DealStructureIncentive = z.infer<typeof dealStructureIncentiveSchema>

// `finalTcp`, `monthlyPayment`, and `depositPercent` are NOT stored — they
// are derived via the helpers in `entities/meetings/lib/compute-deal-derived`
// (same pattern as proposals' `computeFinalTcp`). Persisting them invites
// drift when upstream inputs change without a re-save of this scratchpad.
export const dealStructureSchema = z.object({
  mode: z.enum(['finance', 'cash']),
  startingTcp: z.number(),
  incentives: z.array(dealStructureIncentiveSchema),
  // Finance-specific
  financeTermMonths: z.number().optional(),
  apr: z.number().optional(),
  // Cash-specific
  depositAmount: z.number().optional(),
}).partial()

export type DealStructure = z.infer<typeof dealStructureSchema>

export const closingAdjustmentsSchema = z.object({
  scopeChanges: z.array(z.string()),
  finalNotes: z.string(),
}).partial()

export type ClosingAdjustments = z.infer<typeof closingAdjustmentsSchema>

export const meetingFlowStateSchema = z.object({
  currentStep: z.number().int().min(1).max(7),
  // Step 2: Trade & Pain selections
  tradeSelections: z.array(tradeSelectionSchema),
  // Step 4: Program
  selectedProgram: z.string().nullable(),
  programQualified: z.boolean(),
  // Step 5: Deal Structure
  dealStructure: dealStructureSchema,
  // Step 6: Closing adjustments
  closingAdjustments: closingAdjustmentsSchema,
}).partial()

export type MeetingFlowState = z.infer<typeof meetingFlowStateSchema>
