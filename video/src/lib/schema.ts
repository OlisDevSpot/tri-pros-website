import { z } from 'zod'

export const clipSchema = z.object({
  /** Filename under video/public/ (Remotion staticFile). */
  src: z.string(),
  durationInFrames: z.number().int().positive(),
  /**
   * `full` = full-bleed cover (needs a true 9:16 source clip).
   * `framed` = editorial card on the dark brand ground — native aspect, no
   * quality-destroying crop; use for landscape clips.
   */
  layout: z.enum(['full', 'framed']),
  /** Width/height of the source clip — sizes the framed card. */
  aspect: z.number().positive(),
  /** Uppercase chip above a framed card (e.g. "THE SHOWCASE STANDARD"). */
  label: z.string().nullable(),
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
  /** Checkmark rows shown above the framed card of clips[checkmarkClipIndex]. */
  checkmarks: z.array(z.string()).max(4),
  checkmarkClipIndex: z.number().int().nullable(),
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
