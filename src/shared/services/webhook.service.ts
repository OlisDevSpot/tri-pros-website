/** Incoming webhook verification + routing to jobs */
function createWebhookService() {
  return {
    verifyAndRoute: async (_params: { provider: string, payload: string, signature: string }): Promise<void> => {
      throw new Error('webhookService.verifyAndRoute not implemented')
    },
  }
}

export type WebhookService = ReturnType<typeof createWebhookService>
export const webhookService = createWebhookService()
