import { Client } from '@upstash/qstash'
import env from '@/shared/config/server-env'

export const qstashClient = new Client({
  baseUrl: 'https://qstash-us-east-1.upstash.io',
  token: env.QSTASH_TOKEN,
})
