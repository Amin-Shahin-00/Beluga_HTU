import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Arabic business-plan PDF reads the Amiri font files at runtime.
  outputFileTracingIncludes: { "/api/ai/business-plan/pdf": ["./lib/integrations/fonts/**"] },
};

export default nextConfig;
