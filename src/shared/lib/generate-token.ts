import { randomBytes } from 'node:crypto'

export function generateToken(byteLength = 16): string {
  return randomBytes(byteLength).toString('hex')
}
