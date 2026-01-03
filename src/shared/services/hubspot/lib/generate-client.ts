import { Client } from '@hubspot/api-client'

export async function generateHubspotClient() {
  const hubspotClient = new Client({ accessToken: 'access_token' })
  return hubspotClient
}
