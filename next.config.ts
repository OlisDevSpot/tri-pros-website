import type { NextConfig } from 'next'
import { APP_HOSTS } from './src/shared/config/roots'
import { FUNNEL_SLUGS } from './src/shared/domains/funnels/constants/slugs'

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Allow HMR and /_next/* asset requests through the static ngrok tunnel
  // used by `pnpm dev:mobile`. Without this, Next.js logs a cross-origin
  // warning and (in a future major) will block the requests outright.
  allowedDevOrigins: [
    ...APP_HOSTS.tunnel,
    ...FUNNEL_SLUGS.map(slug => `${slug}.localhost`),
  ],
  // pdfkit reads its 14 standard-font AFM files + sRGB ICC profile via
  // fs.readFileSync(__dirname + '/data/...'). Two things conspire to
  // break this on Vercel:
  //   (1) Webpack inlines pdfkit into .next/server/chunks/<id>.js, so
  //       __dirname at runtime resolves to the chunks dir — not pdfkit's
  //       install dir — and the lookups land at a path that doesn't
  //       exist on disk.
  //   (2) NFT can't statically trace fs.readFileSync(__dirname + ...),
  //       so the data files are pruned from the deployed function.
  // serverExternalPackages fixes (1) by leaving pdfkit unbundled — its
  // require() resolves to node_modules at runtime, where __dirname
  // points at the real pdfkit/js dir. outputFileTracingIncludes fixes
  // (2) by force-including the data/ folder so the AFM/ICC files
  // actually ship next to the code that reads them. Both are required.
  //
  // Important: pdfkit MUST be a direct dependency in package.json. It's
  // pulled in transitively by pdfmake, but under pnpm's isolated layout
  // a transitive dep has no top-level node_modules/<pkg> symlink, and
  // Next.js's resolver can't see it from the project root — so the
  // externalization check silently fails and webpack bundles pdfkit
  // anyway. Promoting it to a direct dep at the version pdfmake wants
  // (^0.18.0) creates the symlink and lets externalization actually take
  // effect. pnpm dedupes, so no duplicate pdfkit install.
  // pnpm layout: real files live under .pnpm/pdfkit@<ver>/... — wildcard
  // survives version bumps.
  serverExternalPackages: ['pdfkit'],
  outputFileTracingIncludes: {
    '/api/qstash-jobs': [
      './node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/data/**/*',
    ],
    // The funnel OG image route reads its font + background photos + logo from
    // public/ via fs at render time (see funnels/lib/og/og-assets.ts). NFT
    // can't trace runtime process.cwd() reads, so force-ship the assets next to
    // the serverless function or prod OG renders 500 (font) / lose the photo.
    '/funnels/[trade]/opengraph-image': [
      './public/fonts/PlayfairDisplay-Bold.ttf',
      './public/portfolio-photos/*.jpeg',
      './public/company/logo/logo-light-512.png',
    ],
  },
  // Service worker headers. Browsers cache /sw.js by default and skip the
  // update check unless the response says otherwise — without no-cache,
  // SW changes don't ship until users hard-refresh, which iOS PWA users
  // can't easily do. The Service-Worker-Allowed header is defensive: it
  // lets the SW control the entire origin even if it were ever served
  // from a sub-path (today it's at root, where no header is needed).
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

export default nextConfig
