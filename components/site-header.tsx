import { Menu, MonitorCog, Phone, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { getSiteConfig } from "@/lib/site-config";

const nav = [
  { href: "/services", label: "수리 서비스" },
  { href: "/requests/new", label: "서비스 신청" },
  { href: "/requests", label: "신청 현황" },
  { href: "/#process", label: "이용 안내" },
  { href: "/#contact", label: "고객센터" },
];

export function SiteHeader() {
  const config = getSiteConfig();
  const phoneHref = `tel:${config.phone.replace(/\D/g, "")}`;

  return (
    <>
      <header className="site-header">
        <div className="utility-bar">
          <div className="container utility-inner">
            <span>
              <ShieldCheck size={14} aria-hidden="true" />
              접수 정보는 운영자만 확인합니다
            </span>
            <Link href="/admin/login">운영자 로그인</Link>
          </div>
        </div>
        <div className="container header-main">
          <Link href="/" className="brand" aria-label={`${config.name} 홈`}>
            <span className="brand-mark">
              <MonitorCog size={26} aria-hidden="true" />
            </span>
            <span>
              <strong>{config.name}</strong>
              <small>COMPUTER REPAIR</small>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="주요 메뉴">
            {nav.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <a className="header-phone" href={phoneHref}>
            <Phone size={20} aria-hidden="true" />
            <span>
              <small>빠른 전화상담</small>
              <strong>{config.phone}</strong>
            </span>
          </a>
          <details className="mobile-menu">
            <summary aria-label="메뉴 열기">
              <Menu className="menu-open-icon" aria-hidden="true" />
              <X className="menu-close-icon" aria-hidden="true" />
            </summary>
            <nav aria-label="모바일 메뉴">
              {nav.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
              <Link href="/admin/login">운영자 로그인</Link>
            </nav>
          </details>
        </div>
      </header>
      <div className="mobile-actions" aria-label="빠른 메뉴">
        <a href={phoneHref}>
          <Phone size={18} aria-hidden="true" />
          전화 상담
        </a>
        <Link href="/requests/new">서비스 신청</Link>
      </div>
    </>
  );
}
