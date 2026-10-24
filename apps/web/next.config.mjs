/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@repo/ui", "@repo/shared", "@repo/database"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
