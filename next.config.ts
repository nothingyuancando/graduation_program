import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  images: {
    remotePatterns: [
      // 如需加载外部图片，在此添加域名
      // { protocol: "https", hostname: "example.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
