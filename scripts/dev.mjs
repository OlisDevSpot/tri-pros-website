#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { getPort } from './lib/get-port.mjs'

const port = getPort()
const child = spawn('next', ['dev', '--port', String(port)], {
  stdio: 'inherit',
  shell: false,
})
child.on('exit', code => process.exit(code ?? 0))
process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
