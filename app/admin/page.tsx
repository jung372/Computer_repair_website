import type { Metadata } from "next";
import { ArrowRight, MessageSquareText, Phone, Search } from "lucide-react";
import Link from "next/link";
import { AdminAccountNav } from "@/components/admin-account-nav";
import { AdminStatusFilter } from "@/components/admin-status-filter";
import { InlineAssignmentForm } from "@/components/inline-assignment-form";
import { StatusBadge } from "@/components/status-badge";
import {
  getDashboardCounts,
  getAdminRequestFilterOptions,
  listAdminRequestRecords,
} from "@/data/admin-request-repository";
import { listAssignmentOptions } from "@/data/staff-slot-repository";
import { CUSTOMER_TYPES } from "@/lib/domain";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "운영자 대시보드",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AdminSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function all(value: string | string[] | undefined) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const admin = await requireAdmin("/admin");
  const query = await searchParams;
  const selectedStatuses = all(query.status);
  const filters = {
    q: first(query.q),
    assignee: admin.role === "OWNER" ? first(query.assignee) : "",
    customerType: first(query.customerType),
    integratedFrom: first(query.integratedFrom),
    integratedTo: first(query.integratedTo),
    receivedFrom: first(query.receivedFrom),
    receivedTo: first(query.receivedTo),
    completedFrom: first(query.completedFrom),
    completedTo: first(query.completedTo),
    statuses: selectedStatuses,
  };
  const [requests, filterOptions, staffAccounts, counts] = await Promise.all([
    listAdminRequestRecords(filters, 200, admin.role === "STAFF" ? admin.id : undefined),
    getAdminRequestFilterOptions(),
    admin.role === "OWNER" ? listAssignmentOptions() : Promise.resolve([]),
    getDashboardCounts(admin.id),
  ]);
  const customerTypes = unique([...CUSTOMER_TYPES, ...filterOptions.customerTypes]);
  const returnTo = buildAdminReturnPath(query);

  return (
    <main id="main-content" className="admin-shell">
      <section className="admin-top">
        <div className="container admin-top-inner">
          <div>
            <span className="eyebrow eyebrow-light">Operations</span>
            <h1>{admin.role === "OWNER" ? "서비스 접수 관리" : "내 배정 신청"}</h1>
            <p>
              {admin.displayName}님, {admin.role === "OWNER"
                ? "전체 접수 내역을 확인하고 담당자를 배정하세요."
                : "운영자가 배정한 신청 내역만 표시됩니다."}
            </p>
          </div>
          <AdminAccountNav user={admin} />
        </div>
      </section>

      <section className="container admin-content">
        <section className={`admin-kpi-grid ${admin.role === "OWNER" ? "owner" : "staff"}`} aria-label="업무 현황">
          {admin.role === "OWNER" && (
            <>
              <article><span>담당자 미할당</span><strong>{counts.unassigned}</strong><small>건</small></article>
              <article><span>총 미접수</span><strong>{counts.totalReceived}</strong><small>건</small></article>
              <article><span>총 미종결</span><strong>{counts.totalUnresolved}</strong><small>건</small></article>
            </>
          )}
          <article><span>내 미접수</span><strong>{counts.received}</strong><small>건</small></article>
          <article><span>내 미종결</span><strong>{counts.unresolved}</strong><small>건</small></article>
        </section>
        <form className="admin-search-panel" action="/admin" method="get">
          <div className="admin-search-heading">
            <div>
              <span className="eyebrow">Request search</span>
              <h2>접수내역 검색</h2>
            </div>
            <p>현재 조건에 맞는 접수 <strong>{requests.length}</strong>건</p>
          </div>

          <div className={`admin-search-grid ${admin.role === "STAFF" ? "staff-scope" : ""}`}>
            <label className="admin-search-keyword">
              <span>검색어</span>
              <div className="admin-input-with-icon">
                <Search size={17} aria-hidden="true" />
                <input
                  name="q"
                  defaultValue={filters.q}
                  placeholder="이름, 제목, 접수번호, 휴대폰 등 키워드"
                />
              </div>
            </label>
            {admin.role === "OWNER" && (
              <label>
                <span>담당기사</span>
                <select name="assignee" defaultValue={filters.assignee}>
                  <option value="">담당자 전체</option>
                  <option value="__UNASSIGNED__">미배정</option>
                  {staffAccounts.map((account) => (
                    <option value={account.accountId} key={account.accountId}>
                      {account.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span>고객구분</span>
              <select name="customerType" defaultValue={filters.customerType}>
                <option value="">분류 전체</option>
                {customerTypes.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
          </div>

          <div className="admin-date-search">
            <DateRange
              label="통합 날짜검색"
              fromName="integratedFrom"
              toName="integratedTo"
              from={filters.integratedFrom}
              to={filters.integratedTo}
              hint="접수일과 완료일을 함께 검색합니다."
            />
            <DateRange
              label="접수일"
              fromName="receivedFrom"
              toName="receivedTo"
              from={filters.receivedFrom}
              to={filters.receivedTo}
            />
            <DateRange
              label="완료일"
              fromName="completedFrom"
              toName="completedTo"
              from={filters.completedFrom}
              to={filters.completedTo}
            />
          </div>

          <AdminStatusFilter selected={selectedStatuses} />

          <div className="admin-search-actions">
            <Link className="button button-secondary" href="/admin">초기화</Link>
            <button className="button button-primary" type="submit">
              <Search size={17} aria-hidden="true" /> 검색
            </button>
          </div>
        </form>

        <div className="admin-table-heading">
          <div>
            <span className="eyebrow">Request list</span>
            <h2>접수내역</h2>
          </div>
          <small>최신 접수번호 순 · 최대 200건</small>
        </div>
        {requests.length ? (
          <>
        <div className="admin-table-wrap admin-request-table-wrap">
          <table className="admin-table admin-operations-table">
            <thead>
              <tr>
                <th>번호</th>
                <th>접수구분</th>
                <th>고객명</th>
                <th>휴대폰</th>
                <th>기본주소</th>
                <th>담당자</th>
                <th>고객구분</th>
                <th>처리상태</th>
                <th>접수일</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td className="admin-serial">{request.serialNumber}</td>
                  <td><span className="receipt-type-chip">{request.receiptType}</span></td>
                  <td>
                    <Link
                      className="admin-customer-link"
                      href={`/admin/requests/${request.publicId}?returnTo=${encodeURIComponent(returnTo)}`}
                    >
                      {request.name || "미상"}
                    </Link>
                  </td>
                  <td>
                    <a className="admin-phone" href={`tel:${request.phone}`}>{request.phone}</a>
                    <a className="admin-sms-link" href={`sms:${request.phone}`}>SMS</a>
                  </td>
                  <td className="admin-address-cell" title={request.address1}>{request.address1}</td>
                  <td>
                    {admin.role === "OWNER" ? (
                      <InlineAssignmentForm
                        publicId={request.publicId}
                        currentAssigneeAccountId={request.assigneeAccountId}
                        options={staffAccounts}
                      />
                    ) : <span>{request.assignee || "미배정"}</span>}
                  </td>
                  <td>{request.customerType}</td>
                  <td><StatusBadge status={request.status} /></td>
                  <td><time dateTime={request.receivedDate}>{request.receivedDate}</time></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-request-card-list">
          {requests.map((request) => {
            const detailHref = `/admin/requests/${request.publicId}?returnTo=${encodeURIComponent(returnTo)}`;
            return (
              <article className="admin-request-card" key={request.id}>
                <header className="admin-request-card-header">
                  <div>
                    <strong>{request.name || "미상"}</strong>
                    <span>{request.receiptType} · {request.customerType}</span>
                  </div>
                  <div className="admin-request-card-reference">
                    <strong>#{request.serialNumber}</strong>
                    <time dateTime={request.receivedDate}>{request.receivedDate}</time>
                  </div>
                </header>

                <div className="admin-request-card-chips">
                  <StatusBadge status={request.status} />
                  <a className="admin-request-phone-chip" href={`tel:${request.phone}`}>
                    <Phone size={14} aria-hidden="true" /> {request.phone}
                  </a>
                  <a className="admin-request-sms-chip" href={`sms:${request.phone}`}>
                    <MessageSquareText size={14} aria-hidden="true" /> SMS
                  </a>
                </div>

                <div className="admin-request-card-body">
                  <Link className="admin-request-card-title" href={detailHref}>
                    {request.title || request.symptom || "수리요청"}
                  </Link>
                  <p className="admin-request-card-symptom">{request.symptom}</p>
                  <p className="admin-request-card-description">{request.description}</p>
                  <p className="admin-request-card-address">{request.address1}</p>
                  {admin.role === "OWNER" ? (
                    <InlineAssignmentForm
                      publicId={request.publicId}
                      currentAssigneeAccountId={request.assigneeAccountId}
                      options={staffAccounts}
                    />
                  ) : (
                    <span className={`admin-request-assignee ${request.assignee ? "assigned" : "unassigned"}`}>
                      {request.assignee || "내 배정"}
                    </span>
                  )}
                </div>

                <Link className="admin-request-card-detail" href={detailHref}>
                  상세보기 / 수정하기 <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>
          </>
        ) : (
          <div className="empty-state">
            <strong>{admin.role === "STAFF" ? "배정된 신청 내역이 없습니다." : "조건에 맞는 접수 내역이 없습니다."}</strong>
            <p>{admin.role === "STAFF" ? "운영자가 담당자로 배정하면 이곳에 표시됩니다." : "검색 조건을 줄이거나 초기화한 뒤 다시 확인해 주세요."}</p>
          </div>
        )}
      </section>
    </main>
  );
}

function buildAdminReturnPath(query: AdminSearchParams) {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) parameters.append(key, item);
    } else if (value) {
      parameters.set(key, value);
    }
  }
  const search = parameters.toString();
  return search ? `/admin?${search}` : "/admin";
}

function DateRange({
  label,
  fromName,
  toName,
  from,
  to,
  hint,
}: {
  label: string;
  fromName: string;
  toName: string;
  from: string;
  to: string;
  hint?: string;
}) {
  return (
    <div className="admin-date-row">
      <span>{label}</span>
      <div>
        <label>
          <span className="sr-only">{label} 시작일</span>
          <input name={fromName} type="date" defaultValue={from} />
        </label>
        <b aria-hidden="true">~</b>
        <label>
          <span className="sr-only">{label} 마침일</span>
          <input name={toName} type="date" defaultValue={to} />
        </label>
        {hint && <small>{hint}</small>}
      </div>
    </div>
  );
}
