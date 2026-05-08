import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function getPort() {
  if (process.env.PORT) {
    return Number(process.env.PORT)
  }
  try {
    const contents = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    const match = contents.match(/^PORT\s*=\s*(\d+)/m)
    if (match) {
      return Number(match[1])
    }
  }
  catch {
    // .env.local optional — fall through to default
  }
  return 3000
}
