import { z } from 'zod'

export const clipSchema = z.object({
  /** Filename under video/public/ (Remotion staticFile). */
  src: z.string(),
  durationInFrames: z.number().int().positive(),
})

export const captionSchema = z.object({
  text: z.string(),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(1),
})

export const showcaseReelSchema = z.object({
  clips: z.array(clipSchema).min(1),
  /** Kinetic hook headline over the first clip (0–~2.5s). */
  hook: z.string(),
  /** Checkmark rows overlaid mid-reel; empty array = skip the overlay. */
  checkmarks: z.array(z.string()).max(4),
  /** Burned-in captions mirroring the voiceover (most viewers watch muted). */
  captions: z.array(captionSchema),
  voiceoverSrc: z.string().nullable(),
  musicSrc: z.string().nullable(),
  /** Music bed level while the voiceover talks (ducked); ~0.15–0.25. */
  musicVolume: z.number().min(0).max(1),
  endCard: z.object({
    headline: z.string(),
    sub: z.string(),
    cta: z.string(),
  }),
  endCardFrames: z.number().int().positive(),
})

export type ShowcaseReelProps = z.infer<typeof showcaseReelSchema>
export type Caption = z.infer<typeof captionSchema>
export type Clip = z.infer<typeof clipSchema>
