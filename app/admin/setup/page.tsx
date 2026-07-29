import type { Metadata } from "next";
import { KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrimaryAdmin } from "@/data/admin-repository";

export const metadata: Metadata = {
  title: "운영자 비밀번호 설정",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getPrimaryAdmin()) redirect("/admin/login");
  const query = await searchParams;
  const messages: Record<string, string> = {
    invalid: "설정 토큰 또는 입력값을 확인해 주세요.",
    blocked: "설정 시도 횟수를 초과했습니다. 15분 뒤 다시 시도해 주세요.",
    config: "최초 설정 토큰이 등록되지 않았습니다. Cloudflare Secret을 확인해 주세요.",
    conflict: "운영자 계정이 이미 생성되었습니다. 로그인해 주세요.",
  };

  return (
    <main id="main-content" className="admin-login-page">
      <div className="admin-login-card admin-setup-card">
        <span className="unlock-icon"><ShieldCheck size={30} aria-hidden="true" /></span>
        <span className="eyebrow">First-time setup</span>
        <h1>운영자 비밀번호 설정</h1>
        <p>Cloudflare에 등록한 최초 설정 토큰으로 소유자를 확인한 뒤 사용할 비밀번호를 정합니다.</p>
        <form action="/api/admin/setup" method="post">
          <label htmlFor="setup-token">최초 설정 토큰</label>
          <div className="unlock-input input-shell">
            <KeyRound size={18} aria-hidden="true" />
            <input id="setup-token" name="setupToken" type="password" autoComplete="off" required />
          </div>
          <label htmlFor="new-admin-password">새 운영자 비밀번호</label>
          <input
            className="standalone-input"
            id="new-admin-password"
            name="newPassword"
            type="password"
            minLength={12}
            maxLength={64}
            autoComplete="new-password"
            required
          />
          <label htmlFor="confirm-admin-password">새 비밀번호 확인</label>
          <input
            className="standalone-input"
            id="confirm-admin-password"
            name="confirmPassword"
            type="password"
            minLength={12}
            maxLength={64}
            autoComplete="new-password"
            required
          />
          {query.error && (
            <p className="field-error" role="alert">
              {messages[query.error] ?? messages.invalid}
            </p>
          )}
          <button className="button button-primary button-large" type="submit">
            운영자 비밀번호 저장
          </button>
        </form>
        <small>설정 완료 후 Cloudflare에서 `ADMIN_SETUP_TOKEN`을 삭제해 주세요.</small>
        <Link className="text-link login-back-link" href="/admin/login">로그인으로 돌아가기</Link>
      </div>
    </main>
  );
}
