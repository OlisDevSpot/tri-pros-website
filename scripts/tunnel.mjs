#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { getPort } from './lib/get-port.mjs'

const NGROK_DOMAIN = 'destined-emu-bold.ngrok-free.app'
const port = getPort()
const child = spawn('ngrok', ['http', `--url=${NGROK_DOMAIN}`, String(port)], {
  stdio: 'inherit',
  shell: false,
})
child.on('exit', code => process.exit(code ?? 0))
process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
