// The dev tool renders React email, which the react-server condition forbids; that condition was only
// there to satisfy `server-only`, so stub that one package and let react resolve to its Node builds.
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return { url: 'data:text/javascript,', format: 'module', shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})
