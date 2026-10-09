import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Bedaya | بداية",
  description: "Start your business in Jordan: roadmap, documents, signing, incubators and an assistant in one workspace.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Each area brings its own styles: the site (app/page.tsx), the M5 staff dashboards (app/m5.css)
// and the developer benches (/ai-bench, /backend).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
