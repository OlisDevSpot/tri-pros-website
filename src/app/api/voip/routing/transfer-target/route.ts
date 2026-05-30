// see docs/codebase-conventions/webhook-routes.md (sync request-response section)
// see docs/plans/voip/INTEGRATION-SEAM.md#1-voip-routing-endpoints
// see docs/plans/voip-campaigns/EPIC.md (Decisions log 2026-05-27 "Major pivot")

/**
 * VoIP routing — transfer-target endpoint.
 *
 * Sync request-response (NOT a webhook): exposed for any external caller that
 * needs a runtime transfer-target lookup (which agent's DID should receive a
 * call right now?).
 *
 * ⚠️ Phase 1 status: NOT USED FOR LEAD CONVERSION as of 2026-05-27.
 * The original use case (AI VoiceAgent confirming interest and warm-transferring
 * mid-call) was removed when AI VoiceAgent was taken off the table. The lead-
 * conversion flow is now Smart Dialer + human-on-line; conversations stay in
 * CloudTalk's softphone with no mid-call transfer.
 *
 * The endpoint remains scaffolded for future post-graduation routing needs
 * (e.g., voip-in-house Phase 1+ inbound routing). Phase 0 mock returns null.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { caller_e164?: string, customer_id?: string } | null = null
  try {
    body = await request.json()
  }
  catch {
    return new Response('Malformed JSON', { status: 400 })
  }

  console.warn('[voip routing/transfer-target] (mocked Phase 0 — pivot deactivated)', {
    caller_e164: body?.caller_e164,
    customer_id: body?.customer_id,
  })

  return Response.json({
    target_e164: null,
    reason: 'phase_0_pivot_no_transfer',
  })
}
