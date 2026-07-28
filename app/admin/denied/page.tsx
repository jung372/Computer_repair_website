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
        <h1>운영자 권한이 없습니다</h1>
        <p>로그인한 이메일이 운영자 허용 목록에 등록되어 있는지 확인해 주세요.</p>
        <Link className="button button-secondary" href="/">홈으로 돌아가기</Link>
      </div>
    </main>
  );
}
