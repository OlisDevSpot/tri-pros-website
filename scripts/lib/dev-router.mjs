// A small reverse proxy that owns the public dev port and starts the real dev
// server on demand.
//
// Why: every worktree runs its own `next dev`, and a healthy one costs ~4 GB
// whether or not anyone is looking at it. With the router in front, the server
// behind a port can be stopped while idle and brought back by the next HTTP
// request, so a dozen worktrees can keep their URLs while only the ones in use
// cost memory.
//
// Only plain HTTP requests wake a stopped server. WebSocket upgrades (Next's
// HMR client reconnecting from a tab left open) are refused while the server
// is down, so an idle browser tab never keeps a server alive or wakes it.
import http from 'node:http'
import net from 'node:net'

/** Resolves once something accepts TCP connections on 127.0.0.1:port. */
export function waitForPort(port, { timeoutMs = 120_000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ port, host: '127.0.0.1' })
      socket.once('connect', () => {
        socket.destroy()
        resolve()
      })
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() > deadline) reject(new Error(`nothing listening on :${port} after ${timeoutMs / 1000}s`))
        else setTimeout(attempt, intervalMs)
      })
    }
    attempt()
  })
}

function isPortFree(port) {
  return new Promise(resolve => {
    const probe = net.createServer()
    probe.once('error', () => resolve(false))
    probe.listen(port, () => probe.close(() => resolve(true)))
  })
}

/** First free port at or above `start`. */
export async function findFreePort(start) {
  for (let port = start; port < start + 200; port++) {
    if (await isPortFree(port)) return port
  }
  throw new Error(`no free port in ${start}-${start + 199}`)
}

function rawRequestHead(req) {
  let head = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    head += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`
  }
  return head + '\r\n'
}

/**
 * Creates (but does not start listening) the public server.
 *
 * - `target()`        → internal port of the dev server, or null while stopped
 * - `ensureRunning()` → resolves once the dev server accepts connections,
 *                        starting it if needed; rejects if it cannot start
 * - `onActivity()`    → called for every HTTP request (idle tracking)
 */
export function createRouter({ target, ensureRunning, onActivity, log }) {
  const agent = new http.Agent({ keepAlive: true, maxSockets: 256 })

  const server = http.createServer(async (req, res) => {
    onActivity()
    try {
      await ensureRunning()
    } catch (err) {
      res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8', 'retry-after': '5' })
      res.end(`dev server failed to start: ${err.message}\n`)
      return
    }
    const upstream = http.request(
      { host: '127.0.0.1', port: target(), method: req.method, path: req.url, headers: req.headers, agent },
      upstreamRes => {
        res.writeHead(upstreamRes.statusCode, upstreamRes.statusMessage, upstreamRes.headers)
        upstreamRes.pipe(res)
      },
    )
    upstream.on('error', err => {
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(`dev server unreachable: ${err.message}\n`)
    })
    req.on('aborted', () => upstream.destroy())
    req.pipe(upstream)
  })

  server.on('upgrade', (req, socket, head) => {
    const port = target()
    if (!port) {
      // Server is stopped: refuse quietly. The HMR client retries with backoff
      // and reconnects once a real request has brought the server back.
      socket.destroy()
      return
    }
    const upstream = net.connect(port, '127.0.0.1', () => {
      upstream.write(rawRequestHead(req))
      if (head.length) upstream.write(head)
      socket.pipe(upstream).pipe(socket)
    })
    upstream.on('error', () => socket.destroy())
    socket.on('error', () => upstream.destroy())
  })

  server.on('error', err => {
    log(`router error: ${err.message}`)
    process.exit(1)
  })

  return server
}
