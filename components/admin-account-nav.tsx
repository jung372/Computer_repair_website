import { KeyRound, LogOut, RadioTower, ReceiptText, UsersRound, Wrench } from "lucide-react";
import Link from "next/link";
import type { AdminUser } from "@/lib/admin-auth";

export function AdminAccountNav({ user }: { user: AdminUser }) {
  return (
    <div className="admin-account">
      <span className={`admin-role-chip ${user.role === "OWNER" ? "owner" : "staff"}`}>
        {user.role === "OWNER" ? "운영자" : "직원"}
        <b>{user.displayName}</b>
        <small>{user.loginName}</small>
      </span>
      <nav className="admin-account-links" aria-label="관리 메뉴">
        <Link href="/admin">신청내역</Link>
        <Link href="/admin/settlements"><ReceiptText size={15} aria-hidden="true" /> 정산내역</Link>
        {user.role === "OWNER" && (
          <>
            <Link href="/admin/staff"><UsersRound size={15} aria-hidden="true" /> 직원 관리</Link>
            <Link href="/admin/marketing"><Wrench size={15} aria-hidden="true" /> 콘텐츠 작업실</Link>
            <Link href="/admin/integrations/vox"><RadioTower size={15} aria-hidden="true" /> 전화 연동</Link>
          </>
        )}
        <Link href="/admin/settings/security">
          <KeyRound size={15} aria-hidden="true" /> 비밀번호 변경
        </Link>
      </nav>
      <form action="/api/admin/logout" method="post">
        <button type="submit"><LogOut size={15} aria-hidden="true" /> 로그아웃</button>
      </form>
    </div>
  );
}
