import { z } from 'zod'

/** A SHA-256 hex string (advanced-matching identifier). */
export const hashedId = z.string().regex(/^[a-f0-9]{64}$/)

/** Unix time in SECONDS (Meta requires seconds, not ms). */
export const unixSeconds = z.number().int().positive()
