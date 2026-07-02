import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";

// Inter is the system's primary typeface: modern, highly legible at small
// sizes (tables, labels, badges), and works well for a data-dense B2B
// dashboard in both light and dark mode. `--font-inter` is consumed by
// `--font-sans` in globals.css, with a safe system-ui fallback stack.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sinery System",
  description: "Sistema operacional para clínicas, by Sinery.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
