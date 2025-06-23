import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AppProviders } from "@/contexts/AppProviders";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Header from "@/components/header";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cliply - Clip, Edit, Share",
  description: "Clip videos easily - upload files or use YouTube URLs for free",
  keywords: [
    "video clipper",
    "video editor",
    "youtube downloader",
    "video trimmer",
    "clip videos",
    "edit videos",
    "free video editor",
    "online video editor",
    "video cutter",
    "ffmpeg",
  ],
  authors: [{ name: "Cliply" }],
  creator: "Cliply",
  publisher: "Cliply",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-icon-57x57.png", sizes: "57x57", type: "image/png" },
      { url: "/apple-icon-60x60.png", sizes: "60x60", type: "image/png" },
      { url: "/apple-icon-72x72.png", sizes: "72x72", type: "image/png" },
      { url: "/apple-icon-76x76.png", sizes: "76x76", type: "image/png" },
      { url: "/apple-icon-114x114.png", sizes: "114x114", type: "image/png" },
      { url: "/apple-icon-120x120.png", sizes: "120x120", type: "image/png" },
      { url: "/apple-icon-144x144.png", sizes: "144x144", type: "image/png" },
      { url: "/apple-icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/apple-icon-180x180.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "apple-touch-icon-precomposed",
        url: "/apple-icon-precomposed.png",
      },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://cliply.fun",
    siteName: "Cliply",
    title: "Cliply - Clip, Edit, Share Videos for Free",
    description:
      "The easiest way to clip videos online. Upload files or use YouTube URLs. Free, fast, and powerful video editing tools powered by FFmpeg.",
    images: [
      {
        url: "/1200x628.jpg",
        width: 1200,
        height: 628,
        alt: "Cliply - Clip, Edit, Share Videos",
        type: "image/jpeg",
      },
      {
        url: "/1080x1080.jpg",
        width: 1080,
        height: 1080,
        alt: "Cliply - Video Clipper Tool",
        type: "image/jpeg",
      },
      {
        url: "/1080x1350.jpg",
        width: 1080,
        height: 1350,
        alt: "Cliply - Online Video Editor",
        type: "image/jpeg",
      },
      {
        url: "/398x208.jpg",
        width: 398,
        height: 208,
        alt: "Cliply - Video Clipping Made Easy",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@cliply",
    creator: "@cliply",
    title: "Cliply - Clip, Edit, Share Videos for Free",
    description:
      "The easiest way to clip videos online. Upload files or use YouTube URLs. Free, fast, and powerful video editing tools.",
    images: [
      {
        url: "/1200x628.jpg",
        alt: "Cliply - Clip, Edit, Share Videos",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "msapplication-TileColor": "#ffffff",
    "msapplication-TileImage": "/ms-icon-144x144.png",
    "msapplication-config": "/browserconfig.xml",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased `}
      >
        <ThemeProvider defaultTheme="dark">
          <AppProviders>
            <Header />
            {children}
          </AppProviders>
          <Analytics />
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
