import env from '@/shared/config/server-env'

// see docs/codebase-conventions/webhook-routes.md (sync request-response section)
// see docs/plans/voip/INTEGRATION-SEAM.md#1-voip-routing-endpoints-cloudtalk-call-flow-designer-http-request--our-app
// see docs/plans/voip-campaigns/phase-0-cloudtalk-setup.md#task-9-end-to-end-smoke-test

/**
 * VoIP routing — transfer-target endpoint.
 *
 * Sync request-response (NOT a webhook): CloudTalk's AI VoiceAgent fires this
 * when it has confirmed interest and needs a human warm-transfer target.
 * Response decides who CloudTalk dials next.
 *
 * Phase 0: returns CLOUDTALK_PHASE0_TRANSFER_TARGET_E164 (Oliver's cell for
 * dev smoke-testing). When voip-in-house Phase 1 ships, this is replaced by
 * services/voip/voip-routing.service.ts#findTransferTarget which computes the
 * real Twilio in-house DID based on sticky-agent rules + availability.
 *
 * MANDATORY: the CloudTalk Call Flow MUST have a fallback branch configured
 * for the "target_e164: null" case. See Phase 0 Task 7.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { caller_e164?: string, customer_id?: string } | null = null
  try {
    body = await request.json()
  }
  catch {
    return new Response('Malformed JSON', { status: 400 })
  }

  const phase0Target = env.CLOUDTALK_PHASE0_TRANSFER_TARGET_E164

  console.warn('[voip routing/transfer-target] (mocked Phase 0)', {
    caller_e164: body?.caller_e164,
    customer_id: body?.customer_id,
    returning_target_e164: phase0Target || null,
  })

  if (!phase0Target) {
    return Response.json({
      target_e164: null,
      reason: 'no_human_available',
    })
  }

  return Response.json({
    target_e164: phase0Target,
    warm_intro: 'Lead from a Tri Pros marketing campaign — they want to chat about a project.',
    custom_parameters: {
      phase0_mock: true,
      customer_id: body?.customer_id ?? null,
    },
  })
}
