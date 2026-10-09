export async function register() {
  // The global, not `node:process`: this file is also compiled for the edge runtime.
  // eslint-disable-next-line node/prefer-global/process
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV !== 'production') {
    const { printProviderStatus } = await import('@/shared/config/server-env')
    printProviderStatus()
  }
}
