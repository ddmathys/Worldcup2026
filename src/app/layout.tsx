import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Worldcup 2026 — Pronostics entre amis",
  description:
    "Pronostiquez les matchs de la Coupe du Monde 2026 avec vos amis. USA · Canada · Mexique.",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "Worldcup 2026 — Pronostics",
    description: "Le jeu de pronostics gratuit pour la Coupe du Monde 2026.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-navy text-white antialiased">
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: "#0f172a",
                color: "#f8fafc",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                fontSize: "14px",
              },
              success: {
                iconTheme: { primary: "#10b981", secondary: "#0f172a" },
              },
              error: {
                iconTheme: { primary: "#ef4444", secondary: "#0f172a" },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
