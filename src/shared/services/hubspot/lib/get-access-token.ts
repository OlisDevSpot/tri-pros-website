import { headers } from 'next/headers'
import { auth } from '../../../auth/server'

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
    // eslint-disable-next-line no-console
    console.log(error)
  }
}
