// `server-only` throws outside Next.js; stubbing that one package lets a CLI import server modules while
// react keeps resolving to its Node builds.
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return { url: 'data:text/javascript,', format: 'module', shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})
