#!/usr/bin/env node
// One-time VAPID key generation. Add the output to .env (and your Vercel
// project env). Generate ONCE and never rotate — the public key is what
// users subscribe with, so rotating invalidates every existing
// subscription on every device.
//
// Run:  node scripts/generate-vapid-keys.mjs

import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()

console.log()
console.log('# Add to .env (and Vercel project env):')
console.log()
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log(`VAPID_SUBJECT=mailto:info@triprosremodeling.com`)
console.log()
console.log('# NEVER rotate these — rotating the public key invalidates every existing subscription on every device.')
console.log()
