import { auth } from '@/shared/auth/server'

export async function GET(req: Request) {
  const { url } = await auth.api.oAuth2LinkAccount({
    body: {
      providerId: 'hubspot',
      callbackURL: '/', // where to go after callback finishes
    },
    headers: req.headers,
  })

  return Response.redirect(url, 302)
}
