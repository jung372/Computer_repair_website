import type { Metadata } from "next";
import { ArrowRight, MessageSquareText, Phone, Search } from "lucide-react";
import Link from "next/link";
import { AdminAccountNav } from "@/components/admin-account-nav";
import { AdminStatusFilter } from "@/components/admin-status-filter";
import { InlineAssignmentForm } from "@/components/inline-assignment-form";
import { StatusBadge } from "@/components/status-badge";
import {
  countAdminRequestRecords,
  getDashboardCounts,
  getAdminRequestFilterOptions,
  listAdminRequestRecords,
} from "@/data/admin-request-repository";
import { listAssignmentOptions } from "@/data/staff-slot-repository";
import {
  ADMIN_DASHBOARD_FILTER_KEYS,
  buildAdminDashboardFilterHref,
  CUSTOMER_TYPES,
  isAdminDashboardFilterActive,
  type AdminDashboardFilterKey,
  type AdminDashboardRole,
} from "@/lib/domain";
import { requireAdmin } from "@/lib/admin-auth";
import { getPagination } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "운영자 대시보드",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AdminSearchParams = Record<string, string | string[] | undefined>;
const ADMIN_PAGE_SIZE = 200;

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
    statuses: selectedStatuses,
  };
  const assignedAccountId = admin.role === "STAFF" ? admin.id : undefined;
  const [totalRequests, filterOptions, staffAccounts, counts] = await Promise.all([
    countAdminRequestRecords(filters, assignedAccountId),
    getAdminRequestFilterOptions(),
    admin.role === "OWNER" ? listAssignmentOptions() : Promise.resolve([]),
    getDashboardCounts(admin.id),
  ]);
  const pagination = getPagination(first(query.page), totalRequests, ADMIN_PAGE_SIZE);
  const requests = await listAdminRequestRecords(
    filters,
    pagination.pageSize,
    assignedAccountId,
    pagination.offset,
  );
  const customerTypes = unique([...CUSTOMER_TYPES, ...filterOptions.customerTypes]);
  const returnTo = buildAdminPagePath(query, pagination.page);
  const selectedDashboard = first(query.dashboard);
  const activeDashboard = ADMIN_DASHBOARD_FILTER_KEYS.find((key) =>
    isAdminDashboardFilterActive(
      selectedDashboard,
      key,
      filters,
      admin.role,
      admin.id,
    ),
  );
  const dashboardCardProps = {
    selectedDashboard,
    filters,
    role: admin.role,
    accountId: admin.id,
  };

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

      <section className="container admin-content admin-content-wide">
        <section className={`admin-kpi-grid ${admin.role === "OWNER" ? "owner" : "staff"}`} aria-label="업무 현황">
          {admin.role === "OWNER" && (
            <>
              <DashboardCard filterKey="unassigned" label="담당자 미배정" count={counts.unassigned} {...dashboardCardProps} />
              <DashboardCard filterKey="total-unresolved" label="총 미종결" count={counts.totalUnresolved} {...dashboardCardProps} />
            </>
          )}
          <DashboardCard filterKey="my-unresolved" label="내 미종결" count={counts.unresolved} {...dashboardCardProps} />
        </section>
        <form className="admin-search-panel" action="/admin" method="get">
          {activeDashboard && <input type="hidden" name="dashboard" value={activeDashboard} />}
          <div className="admin-search-heading">
            <div>
              <span className="eyebrow">Request search</span>
              <h2>접수내역 검색</h2>
            </div>
            <p>현재 조건에 맞는 접수 <strong>{totalRequests}</strong>건</p>
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
          <small>최신 접수번호 순 · 페이지당 {pagination.pageSize}건</small>
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
        <AdminPagination query={query} {...pagination} />
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

function DashboardCard({
  filterKey,
  label,
  count,
  selectedDashboard,
  filters,
  role,
  accountId,
}: {
  filterKey: AdminDashboardFilterKey;
  label: string;
  count: number;
  selectedDashboard: string;
  filters: { assignee: string; statuses: string[] };
  role: AdminDashboardRole;
  accountId: string;
}) {
  const active = isAdminDashboardFilterActive(
    selectedDashboard,
    filterKey,
    filters,
    role,
    accountId,
  );
  return (
    <Link
      className={`admin-kpi-card${active ? " active" : ""}`}
      href={buildAdminDashboardFilterHref(filterKey, role, accountId)}
      aria-current={active ? "page" : undefined}
      aria-label={`${label} ${count}건 접수내역 보기`}
    >
      <span>{label}</span><strong>{count}</strong><small>건</small>
    </Link>
  );
}

function buildAdminPagePath(query: AdminSearchParams, page: number) {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === "page") continue;
    if (Array.isArray(value)) {
      for (const item of value) parameters.append(key, item);
    } else if (value) {
      parameters.set(key, value);
    }
  }
  parameters.set("page", String(page));
  return `/admin?${parameters.toString()}`;
}

function AdminPagination({
  query,
  page,
  totalPages,
  totalItems,
}: {
  query: AdminSearchParams;
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  offset: number;
}) {
  return (
    <nav className="admin-pagination" aria-label="접수내역 페이지">
      {page > 1 ? (
        <Link className="button button-secondary" href={buildAdminPagePath(query, page - 1)}>이전</Link>
      ) : <span className="button button-secondary disabled" aria-disabled="true">이전</span>}
      <strong>{page} / {totalPages} 페이지 · 전체 {totalItems.toLocaleString("ko-KR")}건</strong>
      {page < totalPages ? (
        <Link className="button button-secondary" href={buildAdminPagePath(query, page + 1)}>다음</Link>
      ) : <span className="button button-secondary disabled" aria-disabled="true">다음</span>}
    </nav>
  );
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
