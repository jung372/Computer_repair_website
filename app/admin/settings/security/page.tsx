import type { Metadata } from "next";
import { KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { AdminAccountNav } from "@/components/admin-account-nav";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "비밀번호 변경",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireAdmin("/admin/settings/security");
  const query = await searchParams;
  const messages: Record<string, string> = {
    current: "현재 비밀번호가 일치하지 않습니다.",
    same: "현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.",
    invalid: user.role === "OWNER"
      ? "새 비밀번호를 12~64자로 입력하고 확인값을 맞춰 주세요."
      : "새 비밀번호를 숫자 4자리 이상으로 입력하고 확인값을 맞춰 주세요.",
    blocked: "변경 시도 횟수를 초과했습니다. 15분 뒤 다시 시도해 주세요.",
  };

  return (
    <main id="main-content" className="admin-shell">
      <section className="admin-top admin-detail-top">
        <div className="container admin-top-inner">
          <div>
            <span className="eyebrow eyebrow-light">Security settings</span>
            <h1>비밀번호 변경</h1>
            <p>변경하면 {user.displayName} 계정으로 로그인한 기존 세션이 즉시 만료됩니다.</p>
          </div>
          <AdminAccountNav user={user} />
        </div>
      </section>
      <section className="container admin-security-content">
        <form className="security-settings-card" action="/api/admin/password" method="post">
          <span className="security-card-icon"><ShieldCheck size={26} aria-hidden="true" /></span>
          <h2>새 비밀번호 지정</h2>
          <p>
            현재 비밀번호를 한 번 더 확인합니다. 새 비밀번호는 {user.role === "OWNER" ? "12~64자" : "숫자 4자리 이상"}으로 입력하세요.
          </p>
          <label htmlFor="current-password">현재 비밀번호</label>
          <div className="unlock-input">
            <KeyRound size={18} aria-hidden="true" />
            <input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required />
          </div>
          <label htmlFor="new-password">새 비밀번호</label>
          <input
            className="standalone-input"
            id="new-password"
            name="newPassword"
            type="password"
            minLength={user.role === "OWNER" ? 12 : 4}
            maxLength={64}
            inputMode={user.role === "STAFF" ? "numeric" : undefined}
            pattern={user.role === "STAFF" ? "[0-9]{4,64}" : undefined}
            autoComplete="new-password"
            required
          />
          <label htmlFor="confirm-password">새 비밀번호 확인</label>
          <input
            className="standalone-input"
            id="confirm-password"
            name="confirmPassword"
            type="password"
            minLength={user.role === "OWNER" ? 12 : 4}
            maxLength={64}
            inputMode={user.role === "STAFF" ? "numeric" : undefined}
            pattern={user.role === "STAFF" ? "[0-9]{4,64}" : undefined}
            autoComplete="new-password"
            required
          />
          {query.error && <p className="field-error" role="alert">{messages[query.error] ?? messages.invalid}</p>}
          <button className="button button-primary button-large" type="submit">비밀번호 변경</button>
          <Link className="text-link" href="/admin">대시보드로 돌아가기</Link>
        </form>
      </section>
    </main>
  );
}
