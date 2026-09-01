import { Clock3, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { getSiteConfig } from "@/lib/site-config";

export function SiteFooter() {
  const config = getSiteConfig();
  return (
    <footer className="site-footer" id="contact">
      <div className="container footer-grid">
        <div>
          <strong className="footer-brand">{config.name}</strong>
          <p>
            증상을 과장하지 않고, 확인한 내용과 선택 가능한 수리 방법을
            이해하기 쉽게 설명합니다.
          </p>
        </div>
        <div className="footer-contact">
          <span><Phone size={16} aria-hidden="true" /> {config.phone}</span>
          <span><Clock3 size={16} aria-hidden="true" /> {config.hours}</span>
          <span><MapPin size={16} aria-hidden="true" /> {config.region}</span>
          <span><Mail size={16} aria-hidden="true" /> {config.email}</span>
        </div>
        <div className="footer-links">
          <a href={config.naverBlogUrl} target="_blank" rel="noopener noreferrer">컴박사 블로그</a>
          <Link href="/privacy">개인정보 처리방침</Link>
          <Link href="/requests">내 신청 조회</Link>
          <Link href="/admin/login">운영자 로그인</Link>
        </div>
      </div>
      <div className="container footer-business">
        <span>사업자등록번호 {config.businessNumber}</span>
        <span>대표 {config.representative}</span>
        <span>{config.address}</span>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} {config.name}. All rights reserved.</span>
        <span>{config.name} · {config.phone}</span>
      </div>
    </footer>
  );
}
