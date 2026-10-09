import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bedaya · M5 AI features",
  description: "Assistant, document checker, incubator matching and business plan for Bedaya.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
