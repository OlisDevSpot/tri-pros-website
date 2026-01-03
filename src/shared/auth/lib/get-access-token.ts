import { headers } from 'next/headers'
import { auth } from '../server'

export async function getAccessToken() {
  try {
    const access = await auth.api.getAccessToken({
      body: {
        providerId: 'hubspot',
      },
      headers: await headers(),
    })

    return access
  }
  catch (error) {
    console.log(error)
  }
}
