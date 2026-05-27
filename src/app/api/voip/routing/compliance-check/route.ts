// see docs/codebase-conventions/webhook-routes.md (sync request-response section)
// see docs/plans/voip/INTEGRATION-SEAM.md#1-voip-routing-endpoints-cloudtalk-call-flow-designer-http-request--our-app

/**
 * VoIP routing — compliance-check endpoint.
 *
 * Sync request-response (NOT a webhook): optional belt-and-suspenders gate
 * fired by CloudTalk before placing a campaign call. App-side gate
 * (services/voip/voip-compliance.service.ts) is canonical; this is
 * defense-in-depth.
 *
 * Phase 0: returns allowed=true unconditionally so the smoke-test happy path
 * is unblocked. Phase 1 (voip-in-house): real impl checks voip_dnc + calling
 * hours + global kill switch.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { customer_id?: string, phone_e164?: string } | null = null
  try {
    body = await request.json()
  }
  catch {
    return new Response('Malformed JSON', { status: 400 })
  }

  console.warn('[voip routing/compliance-check] (mocked Phase 0)', {
    customer_id: body?.customer_id,
    phone_e164: body?.phone_e164,
  })

  return Response.json({ allowed: true })
}
