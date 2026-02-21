import type { Job, JobMap } from '@/shared/services/upstash/types'
import { Receiver } from '@upstash/qstash'
import env from '@/shared/config/server-env'

/**
 * An array of jobs we have defined.
 */
const jobs: Job[] = []

/**
 * Register jobs, this is just a simple
 * way to find a job by key.
 */
const registry: JobMap = new Map()

for (const job of jobs) {
  registry.set(job.key, job.handler)
}

const receiver = new Receiver({
  currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY!,
})

/**
 * Next.js route handler.
 */
export async function POST(request: Request) {
  /**
   * Parse the request.
   */
  const url = new URL(request.url)
  const key = url.searchParams.get('job')
  const signature = request.headers.get('Upstash-Signature')

  /**
   * Decode the request body.
   */
  const body = await request.json()

  /**
   * Verify the request.
   */

  if (!signature || !key) {
    return new Response('Missing signature or job key', { status: 403 })
  }

  const valid = await receiver.verify({
    signature,
    body: JSON.stringify(body),
  })

  if (!valid) {
    return new Response('Invalid signature', { status: 400 })
  }

  /**
   * Execute the handler.
   */
  const handler = registry.get(key)
  if (handler)
    await handler(body.payload)

  /**
   * Return a 200 response.
   */
  return new Response()
}
