import type { Metadata } from "next";
import "./globals.css";
import PetBackdrop from "./components/PetBackdrop";
import { LanguageProvider } from "@/lib/i18n";

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
        <PetBackdrop />
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
