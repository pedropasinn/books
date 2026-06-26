import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/content/**": ["./content/**/*"],
    // snapshot read-only do SQLite no bundle (rotas que leem o banco em runtime)
    "/books/**": ["./local.db"],
    "/me": ["./local.db"],
  },
};

export default nextConfig;
