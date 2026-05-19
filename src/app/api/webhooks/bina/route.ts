import env from '@/shared/config/server-env'
import { createCustomerFromWebhook } from '@/shared/dal/server/customers/api'
import { db } from '@/shared/db'
import { binaWebhookLogs, customerNotes } from '@/shared/db/schema'
import { findBestMatch } from '@/shared/lib/fuzzy-match'
import { constructionDataService } from '@/shared/services/construction-data.service'
import { BINA_AUTH_HEADER } from '@/shared/services/providers/gohighlevel/constants'
import { binaContactPayloadSchema } from '@/shared/services/providers/gohighlevel/schemas'

interface MatchedTrade {
  tradeId: string
  tradeName: string
  rawInput: string
  score: number
}

/** GHL sends literal "null" strings for empty custom fields. */
function ghlString(value: string | undefined): string | null {
  if (!value || value === 'null') {
    return null
  }
  return value
}

/**
 * Bina (GoHighLevel) webhook receiver.
 *
 * Creates a customer linked to the 'bina' lead source, fuzzy-matches
 * trades, and adds a formatted customer note with additional data.
 */
export async function POST(request: Request): Promise<Response> {
  // ── Auth ──────────────────────────────────────────────────────────────
  const authHeader = request.headers.get(BINA_AUTH_HEADER)
  const secret = env.BINA_WEBHOOK_SECRET

  if (secret) {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (token !== secret) {
      console.warn('[bina webhook] invalid or missing bearer token')
      return new Response('Unauthorized', { status: 401 })
    }
  }
  else if (env.NODE_ENV === 'production') {
    console.error('[bina webhook] BINA_WEBHOOK_SECRET not configured in production')
    return new Response('Server misconfigured', { status: 500 })
  }
  else {
    console.warn('[bina webhook] no BINA_WEBHOOK_SECRET set — accepting (dev only)')
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let raw: unknown
  try {
    raw = await request.json()
  }
  catch {
    return new Response('Malformed JSON', { status: 400 })
  }

  // ── Validate ──────────────────────────────────────────────────────────
  const result = binaContactPayloadSchema.safeParse(raw)
  if (!result.success) {
    console.warn('[bina webhook] payload failed validation', result.error.flatten())
    return new Response('Invalid payload', { status: 400 })
  }

  const { firstName, lastName, email, phone, city, zip, additionalData } = result.data

  // ── Match trades ──────────────────────────────────────────────────────
  let matchedTrades: MatchedTrade[] | null = null
  const tradesRaw = ghlString(additionalData.trades)

  if (tradesRaw) {
    try {
      const allTrades = await constructionDataService.getTrades()
      const tradeNames = allTrades.map(t => t.name)
      const rawTradeList = tradesRaw.split(',').map(s => s.trim()).filter(Boolean)
      matchedTrades = []

      for (const rawTrade of rawTradeList) {
        const best = findBestMatch(rawTrade, tradeNames)
        if (best) {
          const trade = allTrades[best.index]
          matchedTrades.push({
            tradeId: trade.id,
            tradeName: trade.name,
            rawInput: rawTrade,
            score: best.score,
          })
        }
        else {
          console.warn(`[bina webhook] no trade match for "${rawTrade}"`)
        }
      }
    }
    catch (err) {
      console.error('[bina webhook] failed to fetch/match trades', err)
    }
  }

  // ── Create customer + note ────────────────────────────────────────────
  try {
    const customer = await createCustomerFromWebhook({
      name: `${firstName} ${lastName}`,
      phone,
      email: email || null,
      city,
      zip,
      leadSourceSlug: 'bina',
    })

    // Build formatted note with additional data
    const noteLines: string[] = ['📋 Lead from Bina (GoHighLevel)']
    const budgetSolution = ghlString(additionalData.budgetSolution)
    const rebateAmount = ghlString(additionalData.rebateAmount)

    if (budgetSolution) {
      noteLines.push(`Budget Solution: ${budgetSolution}`)
    }
    if (rebateAmount) {
      noteLines.push(`Rebate Amount: $${rebateAmount}`)
    }
    if (matchedTrades && matchedTrades.length > 0) {
      noteLines.push(`Trades: ${matchedTrades.map(t => t.tradeName).join(', ')}`)
    }

    if (noteLines.length > 1) {
      await db.insert(customerNotes).values({
        customerId: customer.id,
        content: noteLines.join('\n'),
        authorId: null,
      })
    }

    // eslint-disable-next-line no-console
    console.log('[bina webhook] created customer', {
      id: customer.id,
      name: customer.name,
      trades: matchedTrades?.map(t => `${t.rawInput} → ${t.tradeName} (${t.score.toFixed(2)})`) ?? [],
    })
  }
  catch (err) {
    console.error('[bina webhook] failed to create customer', err)
  }

  // ── Log to DB ─────────────────────────────────────────────────────────
  try {
    await db.insert(binaWebhookLogs).values({
      ghlEventType: 'ContactCreate',
      ghlLocationId: null,
      ghlResourceId: email || phone,
      payload: raw as Record<string, unknown>,
      matchedTrades: matchedTrades && matchedTrades.length > 0 ? matchedTrades : null,
      processedAt: null,
    })
  }
  catch (err) {
    console.error('[bina webhook] failed to insert log', err)
  }

  return new Response('OK', { status: 200 })
}
