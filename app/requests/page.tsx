import type { Metadata } from "next";
import { LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { CustomerRequestList } from "@/components/customer-request-list";
import { RequestLookupForm } from "@/components/request-lookup-form";
import { CUSTOMER_LOOKUP_COOKIE } from "@/data/customer-lookup-repository";
import { getCustomerLookupRequests } from "@/lib/logic/customer-lookup";

export const metadata: Metadata = {
  title: "내 신청 조회",
  description: "휴대전화 번호와 신청 비밀번호로 본인의 서비스 신청만 확인하세요.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const token = (await cookies()).get(CUSTOMER_LOOKUP_COOKIE)?.value;
  const requests = await getCustomerLookupRequests(token);

  return (
    <main id="main-content" className="lookup-page">
      <section className="page-hero compact-page-hero lookup-page-hero">
        <div className="container">
          <span className="eyebrow eyebrow-light">My service requests</span>
          <h1>내 신청 조회</h1>
          <p>전체 게시글은 공개하지 않습니다. 본인 정보가 일치하는 신청만 안전하게 보여 드립니다.</p>
        </div>
      </section>
      <section className="section lookup-section">
        <div className="container lookup-layout">
          {requests.length ? (
            <div className="lookup-results">
              <div className="lookup-results-heading">
                <div>
                  <span className="eyebrow">Verified requests</span>
                  <h2>확인된 신청 {requests.length}건</h2>
                  <p>10분 동안 아래 신청의 상세 내용과 처리 상태를 확인할 수 있습니다.</p>
                </div>
                <form action="/requests/lookup/logout" method="post">
                  <button className="button button-secondary" type="submit">
                    <LogOut size={17} aria-hidden="true" /> 조회 종료
                  </button>
                </form>
              </div>
              <CustomerRequestList requests={requests} />
              <div className="lookup-more-actions">
                <Link className="button button-primary" href="/requests/new">새 서비스 신청</Link>
              </div>
            </div>
          ) : (
            <>
              <RequestLookupForm />
              <aside className="lookup-assurance">
                <span className="lookup-assurance-icon"><LockKeyhole size={30} aria-hidden="true" /></span>
                <span className="eyebrow eyebrow-light">Privacy first</span>
                <h2>내 정보는<br />목록에 공개되지 않습니다.</h2>
                <p>이름, 지역, 증상 같은 신청 정보는 공개 게시판에 표시하지 않습니다.</p>
                <ul>
                  <li><ShieldCheck size={18} aria-hidden="true" /> 휴대전화 번호와 비밀번호 모두 확인</li>
                  <li><ShieldCheck size={18} aria-hidden="true" /> 조회 권한은 10분 후 자동 만료</li>
                  <li><ShieldCheck size={18} aria-hidden="true" /> 5회 실패 시 15분 동안 입력 제한</li>
                </ul>
              </aside>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
