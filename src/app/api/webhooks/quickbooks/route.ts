import { createHmac } from 'node:crypto'
import env from '@/shared/config/server-env'
import { syncQbInvoiceJob } from '@/shared/services/upstash/jobs/sync-qb-invoice'
import { syncQbPaymentJob } from '@/shared/services/upstash/jobs/sync-qb-payment'

interface QBWebhookNotification {
  realmId: string
  dataChangeEvent: {
    entities: {
      name: string
      id: string
      operation: string
      lastUpdated: string
    }[]
  }
}

interface QBWebhookPayload {
  eventNotifications: QBWebhookNotification[]
}

function verifyWebhookSignature(payload: string, signature: string): boolean {
  const hash = createHmac('sha256', env.QB_WEBHOOK_VERIFIER_TOKEN)
    .update(payload)
    .digest('base64')
  return hash === signature
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('intuit-signature')

  if (!signature) {
    return new Response('Missing signature', { status: 401 })
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    return new Response('Invalid signature', { status: 401 })
  }

  const payload = JSON.parse(rawBody) as QBWebhookPayload

  const dispatches: Promise<unknown>[] = []

  for (const notification of payload.eventNotifications) {
    const { realmId } = notification

    for (const entity of notification.dataChangeEvent.entities) {
      if (entity.name === 'Payment') {
        dispatches.push(syncQbPaymentJob.dispatch({ paymentId: entity.id, realmId }))
      }
      else if (entity.name === 'Invoice') {
        dispatches.push(syncQbInvoiceJob.dispatch({ invoiceId: entity.id, realmId }))
      }
    }
  }

  await Promise.all(dispatches)

  return new Response('OK', { status: 200 })
}
