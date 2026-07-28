import type { Metadata } from "next";
import { Search } from "lucide-react";
import { RequestList } from "@/components/request-list";
import { REQUEST_STATUSES, STATUS_LABELS } from "@/lib/domain";
import { getPublicBoard } from "@/lib/logic/request-service";

export const metadata: Metadata = {
  title: "신청 현황",
  description: "서비스 신청의 접수번호와 처리 상태를 확인하세요.",
};

export const dynamic = "force-dynamic";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const query = await searchParams;
  const requests = await getPublicBoard(query.q, query.status);

  return (
    <main id="main-content">
      <section className="page-hero compact-page-hero">
        <div className="container">
          <span className="eyebrow eyebrow-light">Request board</span>
          <h1>신청 현황</h1>
          <p>접수번호, 기기 또는 증상으로 내 신청을 찾을 수 있습니다.</p>
        </div>
      </section>
      <section className="section">
        <div className="container board-layout">
          <form className="board-filter" action="/requests" method="get">
            <div>
              <Search size={18} aria-hidden="true" />
              <label className="sr-only" htmlFor="board-search">신청 검색</label>
              <input
                id="board-search"
                name="q"
                defaultValue={query.q}
                placeholder="접수번호 또는 증상"
              />
            </div>
            <label className="sr-only" htmlFor="board-status">상태</label>
            <select id="board-status" name="status" defaultValue={query.status ?? ""}>
              <option value="">전체 상태</option>
              {REQUEST_STATUSES.map((status) => (
                <option key={status} value={status}>{STATUS_LABELS[status]}</option>
              ))}
            </select>
            <button className="button button-secondary">검색</button>
          </form>
          <div className="board-caption">
            <strong>총 {requests.length}건</strong>
            <span>이름·연락처·상세 주소는 공개되지 않습니다.</span>
          </div>
          <RequestList requests={requests} />
        </div>
      </section>
    </main>
  );
}
