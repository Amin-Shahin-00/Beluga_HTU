import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDFs read font files at runtime: Amiri (business plan, M4 review PDF) and IBM Plex Sans Arabic (M5 forms and signatures).
  outputFileTracingIncludes: {
    "/api/ai/business-plan/pdf": ["./lib/integrations/fonts/**"],
    "/api/platform/*": ["./lib/integrations/fonts/**"],
    "/api/documents/generate": ["./assets/fonts/**"],
    "/api/documents/sign-all": ["./assets/fonts/**"],
  },
};

export default nextConfig;
