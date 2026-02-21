import type { NextConfig } from 'next'
import { withPayload } from '@payloadcms/next/withPayload'

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-06be62a0a47b42cbb944ba281f4df793.r2.dev',
      },
    ],
  },
}

export default withPayload(nextConfig)
