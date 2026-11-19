import type { NextConfig } from "next";
import { assertNoPublicSecretEnvironment } from "./src/lib/public-env-boundary";

// Fail the build before Next.js can inline secret-like NEXT_PUBLIC values.
assertNoPublicSecretEnvironment();

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
