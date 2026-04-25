import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Modern, clean font pairing
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Auto Doc Updator",
    template: "%s | Auto Doc Updator",
  },
  description:
    "AI-powered PR analysis and automated documentation generation for developers. Improve code quality and streamline workflows.",
  keywords: [
    "AI documentation",
    "PR analysis",
    "code review automation",
    "developer tools",
    "GitHub automation",
  ],
  authors: [{ name: "Auto Doc Team" }],
  creator: "Auto Doc Team",
  metadataBase: new URL("https://yourdomain.com"), // replace later

  // Favicon & icons
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },

  // Open Graph (for LinkedIn, WhatsApp, Facebook)
  openGraph: {
    title: "Auto Doc Updator",
    description:
      "AI-powered PR analysis and automated documentation generation.",
    url: "https://yourdomain.com",
    siteName: "Auto Doc Updator",
    images: [
      {
        url: "/og-image.png", // add this in public/
        width: 1200,
        height: 630,
        alt: "Auto Doc Updator Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  // Twitter preview
  twitter: {
    card: "summary_large_image",
    title: "Auto Doc Updator",
    description:
      "Automate your PR documentation using AI.",
    images: ["/og-image.png"],
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable} h-full scroll-smooth`}
    >
      <body className="min-h-full flex flex-col bg-white text-gray-900 antialiased">
        {/* Optional: global container */}
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}