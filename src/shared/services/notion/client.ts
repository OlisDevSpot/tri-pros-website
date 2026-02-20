import { Client } from '@notionhq/client'
import env from '@/shared/config/server-env'

export const notionClient = new Client({ auth: env.NOTION_API_KEY })
