import { z } from 'zod'

export const clipSchema = z.object({
  /** Filename under video/public/ (Remotion staticFile). */
  src: z.string(),
  /** `video` plays the file; `image` shows a still with a slow Ken Burns push. */
  kind: z.enum(['video', 'image']),
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
  /** `*word*` marks the emphasis word (brand blue + scale); max one per line. */
  text: z.string(),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(1),
})

/** Punch-in: hard 1-frame scale jump on the clips layer, decaying back over ~10f. */
export const punchInSchema = z.object({
  frame: z.number().int().min(0),
  /** 1.10–1.15 hard, ≤1.20 (digital zoom quality ceiling). */
  scale: z.number().min(1).max(1.2),
})

/** SFX cue — transient must land ON the visual hit frame (editing-patterns.md). */
export const sfxSchema = z.object({
  src: z.string(),
  frame: z.number().int().min(0),
  volume: z.number().min(0).max(1),
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
  /** Caption centerline within the safe zone (0 top … 1 bottom); ~0.55–0.62. */
  captionVertical: z.number().min(0).max(1),
  /** Punch zooms on stressed VO words / downbeats. */
  punchIns: z.array(punchInSchema),
  /** White luma-flash transitions — peak opacity ON these frames (4–6f total). */
  flashFrames: z.array(z.number().int().min(0)),
  /** SFX cues (whoosh/riser/boom/click — see the skill's SFX grammar). */
  sfx: z.array(sfxSchema),
  voiceoverSrc: z.string().nullable(),
  musicSrc: z.string().nullable(),
  /** Small icon-logo watermark, top-right in the safe zone (null = off). */
  watermarkSrc: z.string().nullable(),
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
