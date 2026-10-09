import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Arabic business-plan PDF reads the Amiri font files at runtime.
  // M5 forms and signatures read the IBM Plex Sans Arabic files the same way.
  outputFileTracingIncludes: {
    "/api/ai/business-plan/pdf": ["./lib/integrations/fonts/**"],
    "/api/documents/generate": ["./assets/fonts/**"],
    "/api/documents/sign-all": ["./assets/fonts/**"],
  },
};

export default nextConfig;
