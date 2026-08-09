import type { Metadata } from "next";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { getPrimaryAdmin } from "@/data/admin-repository";
import { LAST_LOGIN_COOKIE } from "@/lib/admin-auth";
import { normalizeLoginName } from "@/lib/account-policy";

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
  const savedLoginName = normalizeLoginName(
    (await cookies()).get(LAST_LOGIN_COOKIE)?.value ?? "",
  );
  const message =
    query.error === "blocked"
      ? "로그인 시도 횟수를 초과했습니다. 15분 뒤 다시 시도해 주세요."
      : query.error === "service"
        ? "보안 설정을 확인한 뒤 다시 시도해 주세요."
        : query.error
        ? "아이디 또는 비밀번호가 일치하지 않습니다."
        : "";

  return (
    <main id="main-content" className="admin-login-page">
      <div className="admin-login-card">
        <span className="unlock-icon"><LockKeyhole size={30} /></span>
        <span className="eyebrow">Administrator</span>
        <h1>운영자 로그인</h1>
        <p>운영자와 직원은 같은 화면에서 발급받은 아이디와 비밀번호로 로그인합니다.</p>
        {(query.setup === "done" || query.changed === "done") && (
          <div className="success-banner login-success-banner">
            <ShieldCheck size={20} aria-hidden="true" />
            <div>
              <strong>{query.setup === "done" ? "운영자 비밀번호를 설정했습니다." : "비밀번호를 변경했습니다."}</strong>
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
          <label htmlFor="admin-login-name">아이디</label>
          <input
            className="standalone-input"
            id="admin-login-name"
            name="loginName"
            defaultValue={savedLoginName}
            autoComplete="username"
            minLength={3}
            maxLength={30}
            required
            autoFocus={!savedLoginName}
          />
          <label htmlFor="admin-password">비밀번호</label>
          <div className="unlock-input input-shell">
            <KeyRound size={18} />
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={64}
              autoFocus={Boolean(savedLoginName)}
            />
          </div>
          {message && <p className="field-error" role="alert">{message}</p>}
          <button className="button button-primary button-large" type="submit">
            로그인
          </button>
        </form>
        <small>로그인에 성공한 아이디만 이 브라우저에 자동 저장됩니다. 비밀번호는 저장하지 않습니다.</small>
      </div>
    </main>
  );
}
