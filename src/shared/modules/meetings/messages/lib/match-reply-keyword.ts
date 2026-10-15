import { CONFIRM_KEYWORDS } from '@/shared/modules/meetings/messages/constants/keywords'

/** Twilio's own rule for keywords: the whole message, not its first word. */
export function matchReplyKeyword(body: string): 'confirm' | null {
  const normalized = body.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim().replace(/\s+/g, ' ')
  return (CONFIRM_KEYWORDS as readonly string[]).includes(normalized) ? 'confirm' : null
}
