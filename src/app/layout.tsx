import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cost Sheet Calculator",
  description: "Real estate inventory pricing dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen" suppressHydrationWarning>{children}</body>
    </html>
  );
}
