import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const DESCRIPTION =
  "조직 기반 트렐로 스타일 업무 분장 시스템 — 칸반 보드, 실시간 협업, 담당자 지정, 초대 링크, 상태별 보기와 타임라인까지.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "TaskFlow · 업무보드",
    template: "%s · TaskFlow",
  },
  description: DESCRIPTION,
  applicationName: "TaskFlow",
  manifest: "/manifest.webmanifest",
  icons: {
    // favicon.ico 는 app/favicon.ico 파일 규칙으로 자동 링크되므로 여기 넣지 않는다
    // (중복 <link> 방지). 고해상도용 PNG 만 추가한다.
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "업무보드",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "TaskFlow",
    title: "TaskFlow · 업무보드",
    description: DESCRIPTION,
    locale: "ko_KR",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TaskFlow — 조직 기반 업무 분장 시스템",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TaskFlow · 업무보드",
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
