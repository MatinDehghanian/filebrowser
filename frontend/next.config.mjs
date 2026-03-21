/** @type {import('next').NextConfig} */
const isExportBuild = process.env.NODE_ENV === "production";

const nextConfig = {
  ...(isExportBuild ? { output: "export" } : {}),
  productionBrowserSourceMaps: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: process.env.BACKEND_URL
          ? `${process.env.BACKEND_URL}/api/:path*`
          : "http://localhost:8080/api/:path*",
      },
    ];
  },
};

export default nextConfig;
