import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/content/**": ["./content/**/*"],
  },
};

export default nextConfig;
