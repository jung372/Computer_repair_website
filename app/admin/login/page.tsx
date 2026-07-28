import type { Metadata } from "next";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { adminSignInPath } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "운영자 로그인",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main id="main-content" className="admin-login-page">
      <div className="admin-login-card">
        <span className="unlock-icon"><LockKeyhole size={30} /></span>
        <span className="eyebrow">Administrator</span>
        <h1>운영자 로그인</h1>
        <p>허용된 운영자 계정으로 로그인해야 신청자의 전체 정보와 내부 메모를 확인할 수 있습니다.</p>
        <Link className="button button-primary button-large" href={adminSignInPath()}>
          <ShieldCheck size={19} /> ChatGPT로 안전하게 로그인
        </Link>
        <small>로그인 후에도 등록된 운영자 이메일만 접근할 수 있습니다.</small>
      </div>
    </main>
  );
}
