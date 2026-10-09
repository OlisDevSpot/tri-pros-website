#!/usr/bin/env node
import { spawn } from 'node:child_process'
import process from 'node:process'
import { getPort } from './lib/get-port.mjs'

// Dev runs on Turbopack; production builds stay on webpack (`next build`).
// `pnpm dev --webpack` is the fallback when Turbopack misbehaves — if the bug
// only shows on Turbopack, it will not reach production, but note it.
const useWebpack = process.argv.includes('--webpack')

const port = getPort()
const args = ['dev', '--port', String(port)]
if (!useWebpack) {
  args.push('--turbopack')
}

const child = spawn('next', args, {
  stdio: 'inherit',
  shell: false,
})
child.on('exit', code => process.exit(code ?? 0))
process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
