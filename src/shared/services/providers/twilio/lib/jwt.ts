import type { MintVoiceAccessTokenInput } from '../schemas/access-token'

import twilio from 'twilio'

import serverEnv from '@/shared/config/server-env'

import { ACCESS_TOKEN_TTL_SECONDS } from '../constants'

// AccessToken JWTs for the browser softphone. The Voice JS SDK initializes
// a `Device` with this token; Twilio's edge validates the signature against
// our API Key SID + Secret. The token's `grants.voice` says which TwiML App
// the browser is allowed to invoke on outbound dial + whether it can receive
// inbound calls.
//
// IMPORTANT: signing uses API Key SID + Secret (NOT the account auth token).
// The auth token signs REST + webhook validation; API Keys sign JWTs.

export function mintVoiceAccessToken(input: MintVoiceAccessTokenInput): string {
  const { AccessToken } = twilio.jwt
  const { VoiceGrant } = AccessToken

  const token = new AccessToken(
    serverEnv.TWILIO_ACCOUNT_SID,
    serverEnv.TWILIO_API_KEY_SID,
    serverEnv.TWILIO_API_KEY_SECRET,
    {
      identity: input.identity,
      ttl: input.ttlSeconds ?? ACCESS_TOKEN_TTL_SECONDS,
    },
  )

  const grant = new VoiceGrant({
    incomingAllow: true,
    outgoingApplicationSid: serverEnv.TWILIO_TWIML_APP_SID,
    outgoingApplicationParams: input.outgoingApplicationParams,
  })

  token.addGrant(grant)

  return token.toJwt()
}
