import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitGlance — read your git log like a senior engineer",
  description:
    "Paste a git log, get velocity, contributor breakdown, hotspots, and risk analysis powered by MiMo v2.5 Pro reasoning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
