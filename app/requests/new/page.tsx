import type { Metadata } from "next";
import { CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { RequestForm } from "@/components/request-form";

export const metadata: Metadata = {
  title: "서비스 신청",
  description: "컴퓨터 수리 서비스를 온라인으로 안전하게 신청하세요.",
};

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ device?: string; symptom?: string }>;
}) {
  const query = await searchParams;
  return (
    <main id="main-content" className="form-page">
      <section className="form-page-side">
        <div>
          <span className="eyebrow eyebrow-light">Secure request</span>
          <h2>안전하게 접수하고<br />진행 상태까지 확인하세요.</h2>
          <p>입력한 연락처와 주소는 공개 목록에 표시되지 않으며 운영자만 확인합니다.</p>
        </div>
        <ul>
          <li><Clock3 size={20} /><span><strong>빠른 접수</strong><small>약 2분이면 신청 완료</small></span></li>
          <li><ShieldCheck size={20} /><span><strong>전체 비공개</strong><small>휴대전화와 비밀번호로 보호</small></span></li>
          <li><CheckCircle2 size={20} /><span><strong>상태 확인</strong><small>접수부터 완료까지 조회</small></span></li>
        </ul>
      </section>
      <div className="form-page-main">
        <RequestForm initialDevice={query.device} initialSymptom={query.symptom} />
      </div>
    </main>
  );
}
