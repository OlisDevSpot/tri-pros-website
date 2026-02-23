import type { PublishRequest } from '@upstash/qstash'
import type { JobHandler } from '../types'
import env from '@/shared/config/server-env'
import { qstashClient } from '../qstash-client'

type DispatchOptions<T> = Omit<
  PublishRequest<T>,
  'body' | 'method' | 'url' | 'urlGroup' | 'topic' | 'api'
>

export function createJob<T>(key: string, handler: JobHandler<T>) {
  return {
    key,
    handler,
    dispatch: async (payload: T, options?: DispatchOptions<T>) => {
      // eslint-disable-next-line no-console
      console.log('DISPATCHING JOB', key)
      try {
        await qstashClient.publishJSON({
          ...options,
          body: payload,
          method: 'POST',
          url: `${env.NEXT_PUBLIC_BASE_URL}/api/qstash-jobs?job=${key}`,
        })
      }
      catch (error) {
        console.error('Something went wrong', error)
      }
    },
  }
}
