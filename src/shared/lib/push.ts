/**
 * Convert a URL-safe base64 VAPID public key into the Uint8Array format
 * `pushManager.subscribe({ applicationServerKey })` requires.
 *
 * VAPID keys are stored as URL-safe base64 (RFC 4648 §5) — the browser
 * wants the raw bytes. The padding adjustment is necessary because the
 * key length isn't always a multiple of 4.
 *
 * Returns Uint8Array<ArrayBuffer> (concrete, not ArrayBufferLike) so the
 * result is assignable to BufferSource — required by pushManager.subscribe's
 * `applicationServerKey`.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const out = new Uint8Array(new ArrayBuffer(rawData.length))
  for (let i = 0; i < rawData.length; i++) {
    out[i] = rawData.charCodeAt(i)
  }
  return out
}
