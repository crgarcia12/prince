import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prince of Persia — Web",
  description: "A browser-based recreation of the classic Prince of Persia (1989) platformer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-950 text-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
