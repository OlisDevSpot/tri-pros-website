import { insertBinaWebhookLog } from '@/shared/dal/server/webhook-logs'

/** Incoming-webhook audit + (future) routing. */
function createWebhookService() {
  return {
    /** Persist a Bina inbound webhook for audit/replay. Best-effort caller-side. */
    logBinaInbound: async (input: {
      ghlEventType: string
      ghlResourceId: string | null
      payload: Record<string, unknown>
    }): Promise<void> => {
      const result = await insertBinaWebhookLog(input)
      if (!result.success) {
        console.error('[webhook] failed to persist bina webhook log', result.error)
      }
    },
  }
}

export type WebhookService = ReturnType<typeof createWebhookService>
export const webhookService = createWebhookService()
