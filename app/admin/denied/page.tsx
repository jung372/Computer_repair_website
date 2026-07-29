import type { Metadata } from "next";
import { ShieldX } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "접근 권한 없음",
  robots: { index: false, follow: false },
};

export default function AdminDeniedPage() {
  return (
    <main id="main-content" className="admin-login-page">
      <div className="admin-login-card">
        <span className="unlock-icon"><ShieldX size={30} /></span>
        <span className="eyebrow">Access denied</span>
        <h1>로그인이 만료되었습니다</h1>
        <p>운영자 페이지를 계속 사용하려면 비밀번호로 다시 로그인해 주세요.</p>
        <Link className="button button-secondary" href="/admin/login">다시 로그인</Link>
      </div>
    </main>
  );
}
