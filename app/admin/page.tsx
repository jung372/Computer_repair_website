import type { Metadata } from "next";
import { Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { AdminStatusFilter } from "@/components/admin-status-filter";
import { StatusBadge } from "@/components/status-badge";
import {
  getAdminRequestFilterOptions,
  listAdminRequestRecords,
} from "@/data/admin-request-repository";
import {
  CUSTOMER_TYPES,
  RECEIPT_TYPES,
} from "@/lib/domain";
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
    receiptType: first(query.receiptType),
    assignee: first(query.assignee),
    customerType: first(query.customerType),
    integratedFrom: first(query.integratedFrom),
    integratedTo: first(query.integratedTo),
    receivedFrom: first(query.receivedFrom),
    receivedTo: first(query.receivedTo),
    completedFrom: first(query.completedFrom),
    completedTo: first(query.completedTo),
    statuses: selectedStatuses,
  };
  const [requests, filterOptions] = await Promise.all([
    listAdminRequestRecords(filters),
    getAdminRequestFilterOptions(),
  ]);
  const receiptTypes = unique([...RECEIPT_TYPES, ...filterOptions.receiptTypes]);
  const customerTypes = unique([...CUSTOMER_TYPES, ...filterOptions.customerTypes]);

  return (
    <main id="main-content" className="admin-shell">
      <section className="admin-top">
        <div className="container admin-top-inner">
          <div>
            <span className="eyebrow eyebrow-light">Operations</span>
            <h1>서비스 접수 관리</h1>
            <p>{admin.displayName}님, 검색 조건으로 접수 내역을 빠르게 확인하고 처리하세요.</p>
          </div>
          <div className="admin-account">
            <span className="admin-identity">보안 세션 사용 중</span>
            <Link className="admin-security-link" href="/admin/settings/security">
              <ShieldCheck size={15} aria-hidden="true" /> 비밀번호 변경
            </Link>
            <form action="/api/admin/logout" method="post">
              <button type="submit">로그아웃</button>
            </form>
          </div>
        </div>
      </section>

      <section className="container admin-content">
        <form className="admin-search-panel" action="/admin" method="get">
          <div className="admin-search-heading">
            <div>
              <span className="eyebrow">Request search</span>
              <h2>접수내역 검색</h2>
            </div>
            <p>현재 조건에 맞는 접수 <strong>{requests.length}</strong>건</p>
          </div>

          <div className="admin-search-grid">
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
            <label>
              <span>접수구분</span>
              <select name="receiptType" defaultValue={filters.receiptType}>
                <option value="">구분 전체</option>
                {receiptTypes.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              <span>담당기사</span>
              <select name="assignee" defaultValue={filters.assignee}>
                <option value="">담당자 전체</option>
                {filterOptions.assignees.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
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
        <div className="admin-table-wrap">
          <table className="admin-table admin-operations-table">
            <thead>
              <tr>
                <th>번호</th>
                <th>접수구분</th>
                <th>고객명</th>
                <th>휴대폰</th>
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
                  <td>{request.receiptType}</td>
                  <td>
                    <Link className="admin-customer-link" href={`/admin/requests/${request.publicId}`}>
                      {request.name || "미상"}
                    </Link>
                  </td>
                  <td>
                    <a className="admin-phone" href={`tel:${request.phone}`}>{request.phone}</a>
                    <a className="admin-sms-link" href={`sms:${request.phone}`}>SMS</a>
                  </td>
                  <td>
                    <span>{request.assignee || "미배정"}</span>
                    {request.assigneePhone && (
                      <a className="admin-sms-link" href={`sms:${request.assigneePhone}`}>SMS</a>
                    )}
                  </td>
                  <td>{request.customerType}</td>
                  <td><StatusBadge status={request.status} /></td>
                  <td><time dateTime={request.receivedDate}>{request.receivedDate}</time></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!requests.length && (
            <div className="empty-state">
              <strong>조건에 맞는 접수 내역이 없습니다.</strong>
              <p>검색 조건을 줄이거나 초기화한 뒤 다시 확인해 주세요.</p>
            </div>
          )}
        </div>
      </section>
    </main>
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
