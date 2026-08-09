import type { Metadata } from "next";
import { headers } from "next/headers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const image = `${origin}/og.png?v=combaksa-202608`;
  return {
    metadataBase: new URL(origin),
    applicationName: "컴박사",
    title: {
      default: "컴박사 | 컴퓨터·노트북 출장 수리",
      template: "%s | 컴박사",
    },
    description:
      "컴퓨터, 노트북, 모니터, 애플기기의 고장 증상과 데이터 복구를 확인하고 온라인으로 안전하게 수리를 신청하세요.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    alternates: {
      canonical: origin,
    },
    openGraph: {
      title: "컴박사",
      siteName: "컴박사",
      description: "멈춘 컴퓨터, 다시 일상으로. 온라인 수리 접수와 진행 조회.",
      type: "website",
      locale: "ko_KR",
      url: origin,
      images: [{ url: image, width: 1730, height: 909, alt: "컴박사 수리 서비스" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "컴박사",
      description: "컴퓨터 수리 접수부터 진행 확인까지 한 번에.",
      images: [image],
    },
  };
}

// Links shared through messengers carry the #contact fragment of the 고객센터
// menu, which would open the page scrolled to the footer. Dropping the fragment
// before the browser resolves the anchor keeps a fresh visit at the top; the
// in-page 고객센터 link still scrolls because that navigation is client-side.
const dropFooterAnchor = `if(location.hash==="#contact"){history.replaceState(null,"",location.pathname+location.search);}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <script dangerouslySetInnerHTML={{ __html: dropFooterAnchor }} />
        <a className="skip-link" href="#main-content">본문 바로가기</a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
