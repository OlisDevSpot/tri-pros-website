import { z } from 'zod'

const cropDataSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
})

export const agentProfileSchema = z.object({
  quote: z.string().optional(),
  bio: z.string().optional(),
  yearsOfExperience: z.number().optional(),
  tradeSpecialties: z.array(z.string()).optional(),
  languagesSpoken: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  headshotUrl: z.string().optional(),
  headshotCropData: z.object({
    app: cropDataSchema.optional(),
    proposal: cropDataSchema.optional(),
  }).optional(),
})

export type AgentProfile = z.infer<typeof agentProfileSchema>
