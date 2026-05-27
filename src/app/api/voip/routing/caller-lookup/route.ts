// see docs/codebase-conventions/webhook-routes.md (sync request-response section)
// see docs/plans/voip/INTEGRATION-SEAM.md#1-voip-routing-endpoints-cloudtalk-call-flow-designer-http-request--our-app

/**
 * VoIP routing — caller-lookup endpoint.
 *
 * Sync request-response (NOT a webhook): CloudTalk's Call Flow Designer fires
 * this mid-call and waits for our response to decide what the AI does next
 * (e.g., personalized greeting based on existing customer state).
 *
 * Phase 0: returns a mocked null-customer response so CloudTalk Call Flow
 * Designer can be wired + the fallback branch validated.
 * Phase 1 (voip-in-house): real impl in services/voip/voip-routing.service.ts
 * looks up customer by E.164, returns enrichment payload.
 *
 * Owner: voip-in-house EPIC.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { caller_e164?: string } | null = null
  try {
    body = await request.json()
  }
  catch {
    return new Response('Malformed JSON', { status: 400 })
  }

  const callerE164 = body?.caller_e164
  console.warn('[voip routing/caller-lookup] (mocked Phase 0)', { caller_e164: callerE164 })

  // Phase 0 mock — returns "unknown caller" shape so the Call Flow's no-match
  // branch fires. To smoke-test the screen-pop happy path, swap this for a
  // hardcoded test customer payload temporarily during the test call.
  return Response.json({
    customer_id: null,
    first_name: null,
    pipeline_stage: null,
    last_interaction_at: null,
  })
}
