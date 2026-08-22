import type { Metadata } from "next";
import Link from "next/link";
import { AdminAccountNav } from "@/components/admin-account-nav";
import { SettlementFilterGroups } from "@/components/settlement-filter-groups";
import { StatusBadge } from "@/components/status-badge";
import {
  getSettlementFilterOptions,
  getSettlementReport,
} from "@/data/settlement-repository";
import {
  PAYMENT_METHODS,
  SETTLEMENT_DEFAULT_STATUSES,
  STATUS_LABELS,
} from "@/lib/domain";
import { requireAdmin } from "@/lib/admin-auth";
import { formatWon } from "@/lib/settlement";

export const metadata: Metadata = {
  title: "정산내역",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function all(value: string | string[] | undefined) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function seoulToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function normalizedPeriod(query: SearchParams) {
  const today = seoulToday();
  const monthStart = `${today.slice(0, 7)}-01`;
  const requestedFrom = first(query.from);
  const requestedTo = first(query.to);
  const from = validDate(requestedFrom) ? requestedFrom : monthStart;
  const to = validDate(requestedTo) ? requestedTo : today;
  const difference = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (difference < 0 || difference > 365) {
    return { from: monthStart, to: today, error: "조회 기간은 시작일이 마침일보다 빠른 366일 이내로 선택해 주세요." };
  }
  return { from, to, error: "" };
}

function withPage(query: SearchParams, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === "page") continue;
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value) params.set(key, value);
  }
  params.set("page", String(page));
  return `/admin/settlements?${params.toString()}`;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const admin = await requireAdmin("/admin/settlements");
  const query = await searchParams;
  const period = normalizedPeriod(query);
  const searched = first(query.searched) === "1";
  const options = await getSettlementFilterOptions();
  const paymentOptions = unique([...PAYMENT_METHODS, ...options.paymentMethods]);
  const requestedPayments = all(query.payment);
  const requestedStatuses = all(query.status);
  const selectedPayments = searched && requestedPayments.length ? requestedPayments : paymentOptions;
  const selectedStatuses = searched && requestedStatuses.length
    ? requestedStatuses
    : [...SETTLEMENT_DEFAULT_STATUSES];
  const requestedPage = Number(first(query.page));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const assignee = admin.role === "OWNER" ? first(query.assignee) : "";
  const report = await getSettlementReport({
    from: period.from,
    to: period.to,
    assignee,
    paymentMethods: selectedPayments.length === paymentOptions.length ? [] : selectedPayments,
    statuses: selectedStatuses,
    page,
    pageSize: 50,
  }, admin.role === "STAFF" ? admin.id : undefined);
  const totalPages = Math.max(1, Math.ceil(report.totals.count / report.pageSize));
  const returnTo = withPage(query, report.page);

  return (
    <main id="main-content" className="admin-shell">
      <section className="admin-top">
        <div className="container admin-top-inner">
          <div>
            <span className="eyebrow eyebrow-light">Settlement</span>
            <h1>정산내역</h1>
            <p>{admin.role === "OWNER" ? "전체 또는 직원별 정산 내역을 확인합니다." : "본인에게 배정된 정산 내역만 표시됩니다."}</p>
          </div>
          <AdminAccountNav user={admin} />
        </div>
      </section>

      <section className="container admin-content settlement-content">
        <form className="settlement-search-panel" action="/admin/settlements" method="get">
          <input type="hidden" name="searched" value="1" />
          <div className="admin-search-heading">
            <div><span className="eyebrow">Settlement search</span><h2>정산 조회</h2></div>
            <p>전체 <strong>{report.totals.count}</strong>건</p>
          </div>
          <div className="settlement-primary-filters">
            <label><span>시작일</span><input type="date" name="from" defaultValue={period.from} required /></label>
            <span aria-hidden="true">~</span>
            <label><span>마침일</span><input type="date" name="to" defaultValue={period.to} required /></label>
            {admin.role === "OWNER" && (
              <label className="settlement-assignee-filter">
                <span>담당자</span>
                <select name="assignee" defaultValue={assignee}>
                  <option value="">담당자 전체</option>
                  <option value="__UNASSIGNED__">미배정</option>
                  {options.assignees.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
                </select>
              </label>
            )}
          </div>
          <SettlementFilterGroups
            paymentOptions={paymentOptions.map((value) => ({ value, label: value }))}
            selectedPayments={selectedPayments}
            statusOptions={SETTLEMENT_DEFAULT_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))}
            selectedStatuses={selectedStatuses}
          />
          {period.error && <p className="admin-record-message error" role="alert">{period.error}</p>}
          <div className="admin-search-actions">
            <Link className="button button-secondary" href="/admin/settlements">금월</Link>
            <button className="button button-primary" type="submit">조회</button>
          </div>
        </form>

        <section className="settlement-summary" aria-label="정산 합계">
          <Summary label="총수금액" value={report.totals.totalAmount} />
          <Summary label="자재비" value={report.totals.materialCost} />
          <Summary label="부가세" value={report.totals.vatAmount} />
          <Summary label="수익금" value={report.totals.income} />
          <Summary label="미수금" value={report.totals.outstandingAmount} warning />
        </section>

        <div className="admin-table-heading">
          <div><span className="eyebrow">Settlement list</span><h2>기간별 내역</h2></div>
          <small>완료일 최신순 · 페이지당 50건</small>
        </div>
        {report.records.length ? (
          <>
            <div className="admin-table-wrap settlement-table-wrap">
              <table className="admin-table settlement-table">
                <thead><tr><th>고객명</th><th>연락처</th><th>완료일</th><th>담당기사</th><th>결제방법</th><th>총수금액</th><th>자재비</th><th>부가세</th><th>수익금</th><th>상태</th></tr></thead>
                <tbody>{report.records.map((record) => (
                  <tr key={record.publicId}>
                    <td><Link className="admin-customer-link" href={`/admin/requests/${record.publicId}?returnTo=${encodeURIComponent(returnTo)}`}>{record.customerName}</Link></td>
                    <td><a className="admin-phone" href={`tel:${record.phone}`}>{record.phone}</a></td>
                    <td>{record.completedDate}</td><td>{record.assignee}</td><td>{record.paymentMethod}</td>
                    <Money value={record.totalAmount} /><Money value={record.materialCost} /><Money value={record.vatAmount} /><Money value={record.income} />
                    <td><StatusBadge status={record.status} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="settlement-card-list">{report.records.map((record) => (
              <article key={record.publicId}>
                <header><Link href={`/admin/requests/${record.publicId}?returnTo=${encodeURIComponent(returnTo)}`}>{record.customerName}</Link><StatusBadge status={record.status} /></header>
                <dl><div><dt>완료일</dt><dd>{record.completedDate}</dd></div><div><dt>담당기사</dt><dd>{record.assignee}</dd></div><div><dt>결제방법</dt><dd>{record.paymentMethod}</dd></div><div><dt>수익금</dt><dd>{formatWon(record.income)}</dd></div></dl>
                <a href={`tel:${record.phone}`}>{record.phone}</a>
              </article>
            ))}</div>
            {totalPages > 1 && <nav className="settlement-pagination" aria-label="정산 페이지">
              {report.page > 1 ? <Link className="button button-secondary" href={withPage(query, report.page - 1)}>이전</Link> : <span />}
              <strong>{report.page} / {totalPages}</strong>
              {report.page < totalPages ? <Link className="button button-secondary" href={withPage(query, report.page + 1)}>다음</Link> : <span />}
            </nav>}
          </>
        ) : <div className="empty-state"><strong>조건에 맞는 정산 내역이 없습니다.</strong><p>기간이나 필터를 변경해 다시 조회해 주세요.</p></div>}
      </section>
    </main>
  );
}

function Summary({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <article className={warning ? "warning" : ""}><span>{label}</span><strong>{formatWon(value)}</strong></article>;
}

function Money({ value }: { value: number }) {
  return <td className="settlement-money">{value.toLocaleString("ko-KR")}원</td>;
}
