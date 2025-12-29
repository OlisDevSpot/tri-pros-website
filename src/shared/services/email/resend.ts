import { Resend } from 'resend'
import env from '@/shared/config/server-env'

export const resendClient = new Resend(env.RESEND_API_KEY)
