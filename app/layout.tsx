import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import AppShell from "./AppShell";

export const metadata: Metadata = {
  title: "Honda Dealership & Workshop ERP | AutoLedger",
  description: "Enterprise management system for Honda showroom, workshop billing, parts catalog and khata ledger",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full m-0 p-0 bg-[#F7F8FA] text-[#172033] font-sans antialiased">
        <LanguageProvider>
          <AuthProvider>
            <AppShell>
              {children}
            </AppShell>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
