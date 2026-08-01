import type { Metadata } from "next";
import { KeyRound, UserPlus, UsersRound } from "lucide-react";
import { AdminAccountNav } from "@/components/admin-account-nav";
import { StaffCreateForm } from "@/components/staff-create-form";
import { listStaffAccounts } from "@/data/admin-repository";
import { requireOwner } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "직원 관리",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const owner = await requireOwner("/admin/staff");
  const [staff, query] = await Promise.all([listStaffAccounts(), searchParams]);
  const message = staffMessage(query.status, query.error);

  return (
    <main id="main-content" className="admin-shell">
      <section className="admin-top">
        <div className="container admin-top-inner">
          <div>
            <span className="eyebrow eyebrow-light">Team access</span>
            <h1>직원 관리</h1>
            <p>직원 로그인 계정을 만들고 접수 배정에 사용할 활성 상태를 관리합니다.</p>
          </div>
          <AdminAccountNav user={owner} />
        </div>
      </section>

      <section className="container admin-content admin-staff-content">
        {message && (
          <p className={`admin-record-message ${query.error ? "error" : ""}`} role="status">
            {message}
          </p>
        )}

        <section className="staff-create-card">
          <div className="staff-section-heading">
            <span><UserPlus size={22} aria-hidden="true" /></span>
            <div>
              <h2>새 직원 계정</h2>
              <p>등록 후 활성 직원만 신청 담당자로 선택할 수 있습니다.</p>
            </div>
          </div>
          <StaffCreateForm />
        </section>

        <section className="staff-list-section">
          <div className="admin-table-heading">
            <div>
              <span className="eyebrow">Staff directory</span>
              <h2>등록 직원</h2>
            </div>
            <small>총 {staff.length}명</small>
          </div>
          {staff.length ? (
            <div className="staff-account-grid">
              {staff.map((account) => (
                <article className={`staff-account-card ${account.isActive ? "" : "inactive"}`} key={account.id}>
                  <header>
                    <span className="staff-avatar"><UsersRound size={21} aria-hidden="true" /></span>
                    <div>
                      <h3>{account.displayName}</h3>
                      <p>{account.loginName}</p>
                    </div>
                    <span className={`staff-state ${account.isActive ? "active" : "inactive"}`}>
                      {account.isActive ? "활성" : "차단"}
                    </span>
                  </header>
                  <dl>
                    <div><dt>연락처</dt><dd>{account.phone || "미등록"}</dd></div>
                    <div><dt>담당 신청</dt><dd>{account.assignedCount}건</dd></div>
                    <div><dt>마지막 로그인</dt><dd>{formatDateTime(account.lastLoginAt)}</dd></div>
                  </dl>
                  <div className="staff-card-actions">
                    <form action="/api/admin/staff" method="post">
                      <input type="hidden" name="action" value="toggle" />
                      <input type="hidden" name="staffId" value={account.id} />
                      <input type="hidden" name="active" value={account.isActive ? "false" : "true"} />
                      <button className="button button-secondary" type="submit">
                        {account.isActive ? "로그인 차단" : "다시 활성화"}
                      </button>
                    </form>
                    <details>
                      <summary><KeyRound size={15} aria-hidden="true" /> 비밀번호 초기화</summary>
                      <form action="/api/admin/staff" method="post">
                        <input type="hidden" name="action" value="reset-password" />
                        <input type="hidden" name="staffId" value={account.id} />
                        <label htmlFor={`staff-password-${account.id}`}>새 숫자 비밀번호</label>
                        <input id={`staff-password-${account.id}`} name="password" type="password" inputMode="numeric" minLength={4} maxLength={64} pattern="[0-9]{4,64}" required autoComplete="new-password" />
                        <button className="button button-primary" type="submit">비밀번호 저장</button>
                      </form>
                    </details>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>등록된 직원이 없습니다.</strong>
              <p>위 입력란에서 첫 직원 계정을 만들어 주세요.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function staffMessage(status?: string, error?: string) {
  if (error === "invalid-phone") return "연락처는 10~11자리 전화번호로 입력해 주세요.";
  if (error === "invalid") return "입력값을 확인해 주세요. 직원 비밀번호는 숫자 4자리 이상입니다.";
  if (error === "duplicate") return "이미 사용 중인 직원 아이디입니다.";
  if (error) return "직원 계정을 처리하지 못했습니다.";
  if (status === "created") return "직원 계정을 등록했습니다.";
  if (status === "password") return "직원 비밀번호를 변경하고 기존 세션을 종료했습니다.";
  if (status === "activated") return "직원 로그인을 다시 활성화했습니다.";
  if (status === "deactivated") return "직원 로그인을 차단하고 기존 세션을 종료했습니다.";
  return "";
}

function formatDateTime(value: string | null) {
  if (!value) return "로그인 기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}
