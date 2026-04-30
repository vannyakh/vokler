import type { NextConfig } from "next";

/** Production: set server-only ``API_URL`` or ``FASTAPI_URL`` for ``/api/proxy`` (not ``NEXT_PUBLIC_*`` unless you accept exposing the API URL in the client bundle). */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
};

export default nextConfig;
