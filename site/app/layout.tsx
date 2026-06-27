import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pedro's Audiobook Lab",
  description: "Biblioteca pessoal de podcasts por capítulo de livros.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${roboto.variable} ${robotoMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              Audiobook Lab
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground">Biblioteca</Link>
              <Link href="/read" className="hover:text-foreground">Leitura</Link>
              <Link href="/me" className="hover:text-foreground">Progresso</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
