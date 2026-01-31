import env from '@/shared/config/server-env'

export function getDocuSignConsentUrl() {
  const params = new URLSearchParams({
    response_type: 'code',
    scope: 'signature impersonation',
    client_id: env.DS_INTEGRATION_KEY,
    redirect_uri: 'http://localhost:3000', // can be dummy
  })

  return `https://account-d.docusign.com/oauth/auth?${params.toString()}`
}

// eslint-disable-next-line no-console
console.log(getDocuSignConsentUrl())
