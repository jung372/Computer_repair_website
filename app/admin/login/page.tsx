import type { Metadata } from "next";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getPrimaryAdmin } from "@/data/admin-repository";

export const metadata: Metadata = {
  title: "운영자 로그인",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; returnTo?: string; setup?: string; changed?: string }>;
}) {
  const query = await searchParams;
  const hasAdmin = Boolean(await getPrimaryAdmin());
  const message =
    query.error === "blocked"
      ? "로그인 시도 횟수를 초과했습니다. 15분 뒤 다시 시도해 주세요."
      : query.error === "service"
        ? "보안 설정을 확인한 뒤 다시 시도해 주세요."
        : query.error
        ? "운영자 비밀번호가 일치하지 않습니다."
        : "";

  return (
    <main id="main-content" className="admin-login-page">
      <div className="admin-login-card">
        <span className="unlock-icon"><LockKeyhole size={30} /></span>
        <span className="eyebrow">Administrator</span>
        <h1>운영자 로그인</h1>
        <p>운영자 비밀번호로 로그인해야 신청자의 전체 정보와 내부 메모를 확인할 수 있습니다.</p>
        {(query.setup === "done" || query.changed === "done") && (
          <div className="success-banner login-success-banner">
            <ShieldCheck size={20} aria-hidden="true" />
            <div>
              <strong>{query.setup === "done" ? "운영자 비밀번호를 설정했습니다." : "운영자 비밀번호를 변경했습니다."}</strong>
              <span>새 비밀번호로 로그인해 주세요.</span>
            </div>
          </div>
        )}
        {!hasAdmin && (
          <div className="setup-callout">
            <strong>아직 운영자 비밀번호가 없습니다.</strong>
            <span>서비스 소유자라면 보호된 최초 설정 화면에서 비밀번호를 지정하세요.</span>
            <Link className="text-link" href="/admin/setup">운영자 비밀번호 설정</Link>
          </div>
        )}
        <form action="/api/admin/session" method="post">
          <input type="hidden" name="returnTo" value={query.returnTo ?? "/admin"} />
          <label htmlFor="admin-password">운영자 비밀번호</label>
          <div className="unlock-input input-shell">
            <KeyRound size={18} />
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={64}
              autoFocus
            />
          </div>
          {message && <p className="field-error" role="alert">{message}</p>}
          <button className="button button-primary button-large" type="submit">
            로그인
          </button>
        </form>
        <small>5회 이상 실패하면 15분 동안 로그인이 제한됩니다.</small>
      </div>
    </main>
  );
}
