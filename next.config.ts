import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 3 MB cover plus article text and multipart overhead.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  reactCompiler: true,
};

export default nextConfig;
