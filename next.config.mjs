/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
    {
      source: '/api/v1/:path*',
      // Proxy /api/v1/* -> backend's /api/v1/* by default
      destination: process.env.NEXT_PUBLIC_API_BASE_URL ? `${process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '')}/:path*` : 'http://127.0.0.1:8000/api/v1/:path*',
    },
    ]
  },
}

export default nextConfig
