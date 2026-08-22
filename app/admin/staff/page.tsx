import type { Metadata } from "next";
import { KeyRound, Send, Trash2, UserPlus, UsersRound } from "lucide-react";
import { AdminAccountNav } from "@/components/admin-account-nav";
import { listStaffSlots, type StaffSlotView } from "@/data/staff-slot-repository";
import { requireOwner } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "직원 슬롯 관리",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const owner = await requireOwner("/admin/staff");
  const [slots, query] = await Promise.all([listStaffSlots(), searchParams]);
  const message = staffMessage(query.status, query.error);

  return (
    <main id="main-content" className="admin-shell">
      <section className="admin-top">
        <div className="container admin-top-inner">
          <div>
            <span className="eyebrow eyebrow-light">Team slots</span>
            <h1>직원 슬롯 관리</h1>
            <p>고정 슬롯 3개의 로그인 계정과 Telegram 알림 대상을 관리합니다.</p>
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
        <div className="staff-slot-grid">
          {slots.map((slot) => <StaffSlotCard slot={slot} key={slot.serialNo} />)}
        </div>
      </section>
    </main>
  );
}

function StaffSlotCard({ slot }: { slot: StaffSlotView }) {
  return (
    <article className={`staff-slot-card ${slot.accountId ? "occupied" : "vacant"}`}>
      <header className="staff-slot-header">
        <span className="staff-avatar"><UsersRound size={21} aria-hidden="true" /></span>
        <div>
          <small>S-{String(slot.serialNo).padStart(4, "0")}</small>
          <h2>{slot.label}</h2>
        </div>
        <span className={`staff-state ${slot.accountId ? "active" : "inactive"}`}>
          {slot.accountId ? "사용 중" : "빈 슬롯"}
        </span>
      </header>

      <section className="staff-slot-section">
        <h3>Telegram 알림</h3>
        <p>
          Chat ID {slot.maskedChatId} · {slot.telegramVerifiedAt ? "전송 확인됨" : "미확인"}
        </p>
        <form action="/api/admin/staff" method="post" className="staff-slot-form">
          <input type="hidden" name="action" value="save-slot" />
          <input type="hidden" name="slotSerialNo" value={slot.serialNo} />
          <label>
            <span>슬롯 이름</span>
            <input name="label" defaultValue={slot.label} maxLength={40} required />
          </label>
          <label>
            <span>새 Chat ID</span>
            <input name="chatId" inputMode="numeric" placeholder="변경할 때만 입력" />
          </label>
          <label>
            <span>운영자 현재 비밀번호</span>
            <input name="currentPassword" type="password" autoComplete="current-password" placeholder="Chat ID 변경·삭제 시 필요" />
          </label>
          <label className="staff-slot-check">
            <input name="telegramEnabled" type="checkbox" defaultChecked={slot.telegramEnabled} />
            <span>배정 알림 사용</span>
          </label>
          <label className="staff-slot-check">
            <input name="clearChatId" type="checkbox" />
            <span>저장된 Chat ID 삭제</span>
          </label>
          <button className="button button-secondary" type="submit">슬롯 설정 저장</button>
        </form>
        {slot.telegramConfigured && (
          <form action="/api/admin/staff" method="post">
            <input type="hidden" name="action" value="test-telegram" />
            <input type="hidden" name="slotSerialNo" value={slot.serialNo} />
            <button className="button button-secondary" type="submit">
              <Send size={16} /> Telegram 테스트
            </button>
          </form>
        )}
      </section>

      {slot.accountId ? <OccupiedSlot slot={slot} /> : <VacantSlot slot={slot} />}
    </article>
  );
}

function VacantSlot({ slot }: { slot: StaffSlotView }) {
  return (
    <section className="staff-slot-section">
      <h3><UserPlus size={18} /> 새 직원 계정 생성</h3>
      <form action="/api/admin/staff" method="post" className="staff-slot-form">
        <input type="hidden" name="action" value="create" />
        <input type="hidden" name="slotSerialNo" value={slot.serialNo} />
        <label><span>직원명</span><input name="displayName" maxLength={30} required /></label>
        <label><span>로그인 아이디</span><input name="loginName" minLength={3} maxLength={30} pattern="[a-z0-9._-]{3,30}" required /></label>
        <label><span>연락처</span><input name="phone" type="tel" placeholder="010-0000-0000" /></label>
        <label><span>숫자 비밀번호</span><input name="password" type="password" inputMode="numeric" minLength={4} maxLength={64} pattern="[0-9]{4,64}" required /></label>
        <button className="button button-primary" type="submit">이 슬롯에 직원 등록</button>
      </form>
    </section>
  );
}

function OccupiedSlot({ slot }: { slot: StaffSlotView }) {
  return (
    <section className="staff-slot-section">
      <h3>현재 직원</h3>
      <dl className="staff-slot-summary">
        <div><dt>직원명</dt><dd>{slot.displayName}</dd></div>
        <div><dt>로그인 ID</dt><dd>{slot.loginName}</dd></div>
        <div><dt>연락처</dt><dd>{slot.phone || "미등록"}</dd></div>
        <div><dt>미해결 업무</dt><dd>{slot.unresolvedCount}건</dd></div>
      </dl>

      <details>
        <summary>직원 정보 수정</summary>
        <form action="/api/admin/staff" method="post" className="staff-slot-form">
          <input type="hidden" name="action" value="edit" />
          <input type="hidden" name="accountId" value={slot.accountId ?? ""} />
          <label><span>직원명</span><input name="displayName" defaultValue={slot.displayName} maxLength={30} required /></label>
          <label><span>로그인 아이디</span><input name="loginName" defaultValue={slot.loginName} minLength={3} maxLength={30} pattern="[a-z0-9._-]{3,30}" required /></label>
          <label><span>연락처</span><input name="phone" type="tel" defaultValue={slot.phone} /></label>
          <p>로그인 ID를 바꾸면 새 직원으로 처리되어 과거 업무는 보이지 않고, 기존 미해결 업무는 미배정으로 전환됩니다.</p>
          <label><span>운영자 현재 비밀번호</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <button className="button button-secondary" type="submit">직원 정보 저장</button>
        </form>
      </details>

      <details>
        <summary><KeyRound size={15} /> 비밀번호 초기화</summary>
        <form action="/api/admin/staff" method="post" className="staff-slot-form">
          <input type="hidden" name="action" value="reset-password" />
          <input type="hidden" name="accountId" value={slot.accountId ?? ""} />
          <label><span>새 숫자 비밀번호</span><input name="password" type="password" inputMode="numeric" minLength={4} maxLength={64} pattern="[0-9]{4,64}" required /></label>
          <label><span>운영자 현재 비밀번호</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <button className="button button-secondary" type="submit">비밀번호 저장</button>
        </form>
      </details>

      <details className="staff-danger-zone">
        <summary>퇴사 및 삭제</summary>
        <form action="/api/admin/staff" method="post" className="staff-slot-form">
          <input type="hidden" name="action" value="offboard" />
          <input type="hidden" name="accountId" value={slot.accountId ?? ""} />
          <p>로그인을 차단하고 미해결 업무를 미배정으로 돌립니다. 과거 종결 업무는 보존됩니다.</p>
          <label><span>운영자 현재 비밀번호</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <button className="button button-danger" type="submit">퇴사 처리</button>
        </form>
        {slot.canDelete && (
          <form action="/api/admin/staff" method="post" className="staff-slot-form">
            <input type="hidden" name="action" value="delete" />
            <input type="hidden" name="accountId" value={slot.accountId ?? ""} />
            <p>로그인·배정 이력이 없는 잘못 생성한 계정만 영구 삭제할 수 있습니다.</p>
            <label><span>로그인 ID 확인</span><input name="confirmation" placeholder={slot.loginName} required /></label>
            <label><span>운영자 현재 비밀번호</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
            <button className="button button-danger" type="submit"><Trash2 size={16} /> 직원 영구 삭제</button>
          </form>
        )}
      </details>
    </section>
  );
}

function staffMessage(status?: string, error?: string) {
  const errors: Record<string, string> = {
    INVALID_STAFF_INPUT: "직원 아이디와 숫자 비밀번호 입력값을 확인해 주세요.",
    INVALID_PHONE: "연락처는 10~11자리 전화번호로 입력해 주세요.",
    INVALID_CHAT_ID: "Telegram Chat ID 형식을 확인해 주세요.",
    OWNER_PASSWORD_INVALID: "운영자 현재 비밀번호가 올바르지 않습니다.",
    SLOT_OCCUPIED: "이미 직원이 사용 중인 슬롯입니다.",
    LOGIN_NAME_EXISTS: "이미 사용 중인 로그인 아이디입니다.",
    STAFF_DELETE_NOT_ALLOWED: "로그인 또는 업무 이력이 있어 영구 삭제할 수 없습니다.",
    STAFF_CHAT_ID_NOT_CONFIGURED: "이 슬롯의 Telegram Chat ID가 설정되지 않았습니다.",
    TELEGRAM_BOT_TOKEN_NOT_CONFIGURED: "Telegram Bot Token이 설정되지 않았습니다.",
    STAFF_CHAT_ID_ENCRYPTION_KEY_NOT_CONFIGURED: "직원 Chat ID 암호화 Secret이 필요합니다.",
  };
  if (error) return errors[error] ?? "직원 슬롯을 처리하지 못했습니다.";
  const statuses: Record<string, string> = {
    "slot-saved": "슬롯 설정을 저장했습니다.",
    "telegram-tested": "Telegram 테스트 메시지를 전송했습니다.",
    created: "직원 계정을 등록했습니다.",
    updated: "직원 정보를 수정했습니다.",
    password: "직원 비밀번호를 변경하고 기존 세션을 종료했습니다.",
    offboarded: "퇴사 처리하고 미해결 업무를 미배정으로 변경했습니다.",
    deleted: "잘못 생성된 직원 계정을 영구 삭제했습니다.",
  };
  return status ? statuses[status] ?? "" : "";
}
