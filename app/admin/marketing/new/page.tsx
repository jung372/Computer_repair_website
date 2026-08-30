import type { Metadata } from "next";
import Link from "next/link";
import { AdminAccountNav } from "@/components/admin-account-nav";
import { MarketingJobForm } from "@/components/marketing-job-form";
import { requireOwner } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "수리일지 생성", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NewMarketingJobPage() {
  const owner = await requireOwner("/admin/marketing/new");
  return (
    <main id="main-content" className="admin-shell marketing-shell">
      <section className="admin-top marketing-hero"><div className="container admin-top-inner"><div><span className="eyebrow eyebrow-light">Repair story intake</span><h1>수리일지 생성</h1><p>짧은 현장 사실과 보호된 사진을 로컬 AI 작업대로 보냅니다.</p></div><AdminAccountNav user={owner} /></div></section>
      <section className="container admin-content marketing-content">
        <nav className="marketing-breadcrumb" aria-label="마케팅 작업 위치"><Link href="/admin/marketing">콘텐츠 작업실</Link><span>/</span><strong>새 수리일지</strong></nav>
        <div className="workbench-strip" aria-label="수리일지 처리 단계">
          <span className="active"><b>1</b>현장 입력</span><i /><span><b>2</b>사진 보호</span><i /><span><b>3</b>로컬 AI</span><i /><span><b>4</b>운영자 검토</span><i /><span><b>5</b>발행</span>
        </div>
        <MarketingJobForm />
      </section>
    </main>
  );
}
