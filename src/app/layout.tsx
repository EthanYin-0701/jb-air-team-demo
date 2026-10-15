import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PawGroove - Pet Dance Video Generator",
  description: "Generate amazing dance videos of your pets using AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
