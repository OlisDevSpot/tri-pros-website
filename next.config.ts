import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
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
  // pnpm layout: real files live under .pnpm/pdfkit@<ver>/... — wildcard
  // survives version bumps.
  serverExternalPackages: ['pdfkit'],
  outputFileTracingIncludes: {
    '/api/qstash-jobs': [
      './node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/data/**/*',
    ],
  },
}

export default nextConfig
