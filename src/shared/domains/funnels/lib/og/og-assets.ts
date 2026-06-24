import type { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import 'server-only'

/**
 * OG render assets are read from `public/` on the local filesystem — NOT
 * self-fetched over HTTP. A self-fetch from inside the OG route to its own
 * origin deadlocks/stalls a single dev process, and adds a runtime network
 * dependency in prod. fs reads are local and synchronous-fast. The files must
 * be force-shipped to the serverless function via `outputFileTracingIncludes`
 * in next.config.ts (NFT can't trace a runtime `process.cwd()` path), exactly
 * like the pdfkit AFM/ICC assets. see ../../DOCS.md#funnel-metadata
 */
const MIME: Record<string, string> = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
}

function publicPath(relPath: string): string {
  return join(process.cwd(), 'public', relPath.replace(/^\//, ''))
}

/** Raw bytes of a `public/` asset (e.g. an OG font). */
export async function readPublicBuffer(relPath: string): Promise<Buffer> {
  return readFile(publicPath(relPath))
}

/** A `public/` image as a base64 data URI Satori can embed as `<img src>`. */
export async function readPublicDataUri(relPath: string): Promise<string> {
  const ext = relPath.slice(relPath.lastIndexOf('.')).toLowerCase()
  const data = await readFile(publicPath(relPath))
  return `data:${MIME[ext] ?? 'image/jpeg'};base64,${data.toString('base64')}`
}
