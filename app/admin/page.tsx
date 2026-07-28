import type { Metadata } from "next";
import { BellRing, ChevronRight, ClipboardList, Search, Wrench } from "lucide-react";
import Link from "next/link";
import { listAdminRequests, requestStats } from "@/data/request-repository";
import { StatusBadge } from "@/components/status-badge";
import { DEVICE_LABELS, REQUEST_STATUSES, STATUS_LABELS } from "@/lib/domain";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "운영자 대시보드",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const admin = await requireAdmin("/admin");
  const query = await searchParams;
  const [requests, stats] = await Promise.all([
    listAdminRequests(query.q, query.status),
    requestStats(),
  ]);
  const total = Object.values(stats).reduce((sum, value) => sum + Number(value), 0);

  return (
    <main id="main-content" className="admin-shell">
      <section className="admin-top">
        <div className="container admin-top-inner">
          <div>
            <span className="eyebrow eyebrow-light">Operations</span>
            <h1>서비스 신청 관리</h1>
            <p>{admin.displayName}님, 오늘의 접수와 처리 상태를 확인하세요.</p>
          </div>
          <span className="admin-identity">{admin.email}</span>
        </div>
      </section>
      <section className="container admin-content">
        <div className="admin-stat-grid">
          <Link href="/admin">
            <ClipboardList size={22} /><span><small>전체 신청</small><strong>{total}</strong></span>
          </Link>
          <Link href="/admin?status=RECEIVED">
            <BellRing size={22} /><span><small>신규 접수</small><strong>{stats.RECEIVED ?? 0}</strong></span>
          </Link>
          <Link href="/admin?status=REPAIRING">
            <Wrench size={22} /><span><small>수리중</small><strong>{stats.REPAIRING ?? 0}</strong></span>
          </Link>
          <Link href="/admin?status=COMPLETED">
            <ClipboardList size={22} /><span><small>완료</small><strong>{stats.COMPLETED ?? 0}</strong></span>
          </Link>
        </div>
        <form className="board-filter admin-filter" action="/admin" method="get">
          <div>
            <Search size={18} />
            <label className="sr-only" htmlFor="admin-search">접수 검색</label>
            <input
              id="admin-search"
              name="q"
              defaultValue={query.q}
              placeholder="접수번호, 이름, 연락처, 주소, 증상"
            />
          </div>
          <label className="sr-only" htmlFor="admin-status-filter">상태</label>
          <select id="admin-status-filter" name="status" defaultValue={query.status ?? ""}>
            <option value="">전체 상태</option>
            {REQUEST_STATUSES.map((status) => (
              <option value={status} key={status}>{STATUS_LABELS[status]}</option>
            ))}
          </select>
          <button className="button button-secondary">검색</button>
        </form>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>상태</th><th>접수</th><th>신청자</th><th>연락처</th><th>지역</th><th>알림</th><th />
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td><StatusBadge status={request.status} /></td>
                  <td><strong>{request.symptom}</strong><small>{request.publicId} · {DEVICE_LABELS[request.deviceType]}</small></td>
                  <td>{request.name}</td>
                  <td>{request.phone}</td>
                  <td>{request.regionPublic}</td>
                  <td><span className={`notification-state notification-${request.notificationStatus.toLowerCase()}`}>{request.notificationStatus}</span></td>
                  <td><Link aria-label={`${request.publicId} 상세`} href={`/admin/requests/${request.publicId}`}><ChevronRight /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!requests.length && <div className="empty-state"><strong>조건에 맞는 신청이 없습니다.</strong></div>}
        </div>
      </section>
    </main>
  );
}
