import type { Metadata } from "next";
import "./globals.css";
import PetBackdrop from "./components/PetBackdrop";
import ThemeToggle from "./components/ThemeToggle";
import { themeInitScript } from "@/lib/theme";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <PetBackdrop />
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
