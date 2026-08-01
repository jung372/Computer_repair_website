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
        <h1>접근 권한이 없습니다</h1>
        <p>이 계정에 배정되지 않은 신청이거나 운영자 전용 메뉴입니다.</p>
        <Link className="button button-secondary" href="/admin">내 신청 목록으로</Link>
      </div>
    </main>
  );
}
