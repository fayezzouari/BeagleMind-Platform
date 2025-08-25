import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthSessionProvider from "@/components/session-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BeagleMind - Your BeagleBoard AI Assistant",
  description: "Intelligent BeagleBoard assistant for hardware development, GPIO programming, and embedded systems guidance.",
  icons: {
    icon: "/beagleboard-logo.png",
    apple: "/beagleboard-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Explicit favicon links to override default Vercel icon */}
        <link rel="icon" href="/beagleboard-logo.png" />
        <link rel="apple-touch-icon" href="/beagleboard-logo.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
  <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
