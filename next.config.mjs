/** @type {import('next').NextConfig} */
const nextConfig = {
  // No `ignoreBuildErrors` on purpose: `npx tsc --noEmit` is clean, and a
  // terminal that ships type errors is a terminal that will lie about numbers.
  images: {
    unoptimized: true,
  },
}

export default nextConfig
