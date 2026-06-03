import type { PublishRequest } from '@upstash/qstash'
import type { JobHandler } from '../types'
import { getPublicBaseUrl } from '@/shared/config/public-url'
import { qstashClient } from '../qstash-client'

type DispatchOptions<T> = Omit<
  PublishRequest<T>,
  'body' | 'method' | 'url' | 'urlGroup' | 'topic' | 'api'
>

export function createJob<T>(key: string, handler: JobHandler<T>) {
  // The QStash publish call — single source of truth for both dispatch variants.
  // Returns void; throws on transport / auth / quota failures.
  const publish = async (payload: T, options?: DispatchOptions<T>) =>
    qstashClient.publishJSON({
      ...options,
      body: payload,
      method: 'POST',
      url: `${getPublicBaseUrl()}/api/qstash-jobs?job=${key}`,
    })

  return {
    key,
    handler,
    /**
     * Best-effort dispatch. Logs and swallows QStash transport errors so the
     * caller's mutation can still return successfully. Use for cosmetic /
     * non-critical work (image optimization, view-tracking pings,
     * "you were added" courtesy notifications) where a dropped enqueue is
     * acceptable. Pair with explicit `void job.dispatch(...).catch(...)` at
     * the call site to document intent.
     *
     * For critical work (data-integrity, calendar sync, time-changed pushes
     * — anything where silent loss is a bug), use `dispatchOrThrow` instead.
     * see docs/codebase-conventions/service-architecture.md#background-side-effects-via-qstash-jobs
     */
    dispatch: async (payload: T, options?: DispatchOptions<T>) => {
      // eslint-disable-next-line no-console
      console.log('DISPATCHING JOB', key)
      try {
        await publish(payload, options)
      }
      catch (error) {
        console.error('Something went wrong', error)
      }
    },
    /**
     * Strict dispatch. Bubbles up QStash transport errors so the caller's
     * mutation fails loudly if the enqueue can't be confirmed. Use for
     * critical side effects (GCal sync, propagation, time-changed pushes)
     * where a silent drop is worse than a visible 500 — the user can retry,
     * but they cannot recover from work that quietly never happened.
     *
     * Handlers MUST be idempotent — QStash retries automatically on
     * downstream failure.
     * see docs/codebase-conventions/service-architecture.md#background-side-effects-via-qstash-jobs
     */
    dispatchOrThrow: async (payload: T, options?: DispatchOptions<T>) => {
      // eslint-disable-next-line no-console
      console.log('DISPATCHING JOB (strict)', key)
      await publish(payload, options)
    },
  }
}
