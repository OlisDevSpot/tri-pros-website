import type { InferRealtimeEvents } from '@upstash/realtime'
import { Realtime } from '@upstash/realtime'
import z from 'zod'
import { customerProfileSchema, financialProfileSchema, propertyProfileSchema } from '@/shared/entities/customers/schemas'
import { meetingContextSchema, meetingFlowStateSchema } from '@/shared/entities/meetings/schemas'
import { redis } from './redis-client'

const schema = {
  meeting: {
    flowStateUpdated: meetingFlowStateSchema,
    contextUpdated: meetingContextSchema,
    customerProfileUpdated: z.object({
      customerProfileJSON: customerProfileSchema.optional(),
      propertyProfileJSON: propertyProfileSchema.optional(),
      financialProfileJSON: financialProfileSchema.optional(),
    }),
    outcomeUpdated: z.object({ meetingOutcome: z.string() }),
    agentNotesUpdated: z.object({ agentNotes: z.string() }),
  },
}

export const realtime = new Realtime({ schema, redis })
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>
