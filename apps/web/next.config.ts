import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@arena/core", "@arena/policy", "@arena/verification", "@arena/workspace", "@arena/pty", "@arena/config"],
};

export default nextConfig;
