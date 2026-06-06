import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fortress Games",
  description: "Multiplayer lobby and room games"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <div className="flex-1">{children}</div>
        <footer className="flex items-center justify-center gap-2 border-t border-slate-800 px-6 py-4 text-center text-sm text-slate-400">
          <img src="/logo.svg" alt="" aria-hidden="true" className="h-5 w-5 opacity-80" />
          <a
            href="https://github.com/yifeiwu/fortress-games"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Fortress Games on GitHub ↗
          </a>
        </footer>
      </body>
    </html>
  );
}
