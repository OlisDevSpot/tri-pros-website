import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { customerIntakeService } from '@/shared/services/customer-intake.service'
import { gohighlevelClient } from '@/shared/services/providers/gohighlevel/client'
import { normalizeBinaLead } from '@/shared/services/providers/gohighlevel/lib/normalize-bina-lead'
import { webhookService } from '@/shared/services/webhook.service'

/**
 * Bina (GoHighLevel) webhook receiver. Thin orchestrator (webhook-routes.md
 * Rule 2): auth → parse → normalize (provider lib) → ingest (service) → audit
 * (service) → 200. No mapping, no fuzzy-match, no raw db here.
 */
export async function POST(request: Request): Promise<Response> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get(gohighlevelClient.authHeaderName)
  if (!gohighlevelClient.verifyWebhookSecret({ authHeader })) {
    return new Response('Unauthorized', { status: 401 })
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let raw: unknown
  try {
    raw = await request.json()
  }
  catch {
    return new Response('Malformed JSON', { status: 400 })
  }

  const parsed = gohighlevelClient.parseBinaWebhook(raw)
  if (!parsed.ok) {
    return new Response('Invalid payload', { status: 400 })
  }

  // ── Normalize + ingest ────────────────────────────────────────────────────
  const { core, leadMeta, note } = normalizeBinaLead(parsed.payload)
  const result = await customerIntakeService.ingestLead(SYSTEM_CONTEXT, {
    core,
    leadMeta,
    note,
    meeting: null, // Bina never auto-creates a meeting (D9); scheduledFor is for human pre-fill
  })

  if (!result.success) {
    console.error('[bina webhook] ingest failed', result.error)
  }
  else {
    // eslint-disable-next-line no-console
    console.log('[bina webhook] created customer', { id: result.data.customer.id, name: result.data.customer.name })
  }

  // ── Audit (always, even on ingest failure — captures the raw payload) ───────
  await webhookService.logBinaInbound({
    ghlEventType: 'ContactCreate',
    ghlResourceId: parsed.payload.email || parsed.payload.phone,
    payload: raw as Record<string, unknown>,
  })

  return new Response('OK', { status: 200 })
}
