import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Force-include pdfkit's Adobe Font Metrics (.afm) + ICC color profile
  // into the qstash-jobs serverless bundle. pdfkit reads these at runtime
  // via fs.readFileSync(__dirname + '/data/...') which Next.js's static
  // trace doesn't follow automatically. Without this, pdfmake throws
  // ENOENT on Vercel even though the same code works locally via tsx.
  // pnpm install layout: actual files live under .pnpm/pdfkit@<ver>/...,
  // not at the symlinked node_modules/pdfkit path. The wildcard survives
  // pdfkit version bumps. Glob covers all 14 AFM fonts + sRGB ICC profile
  // (~70 KB total).
  outputFileTracingIncludes: {
    '/api/qstash-jobs': [
      './node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/data/**/*',
    ],
  },
}

export default nextConfig
