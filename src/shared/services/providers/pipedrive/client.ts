import { v2 } from 'pipedrive'
import env from '@/shared/config/server-env'

export const pipedriveConfig = new v2.Configuration({
  apiKey: env.PIPEDRIVE_API_KEY,
})
