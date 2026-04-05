import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    loader: 'custom',
    loaderFile: './src/shared/lib/cloudflare-image-loader.ts',
  },
}

export default nextConfig
