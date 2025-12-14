import { ApiClient } from '@mondaydotcomorg/api'
import env from '@/config/server-env'

export const mondayClient = new ApiClient({ token: env.MONDAY_API_TOKEN })
