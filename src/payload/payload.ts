import { getPayload } from 'payload'
import configPromise from '@/payload.config'

export function payloadClient() {
  return getPayload({ config: configPromise })
}
