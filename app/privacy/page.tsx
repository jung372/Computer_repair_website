import type { Metadata } from "next";
import { getSiteConfig } from "@/lib/site-config";

export const metadata: Metadata = { title: "개인정보 처리방침" };

export default function PrivacyPage() {
  const config = getSiteConfig();
  return (
    <main id="main-content">
      <section className="page-hero compact-page-hero">
        <div className="container">
          <span className="eyebrow eyebrow-light">Privacy</span>
          <h1>개인정보 처리방침</h1>
          <p>서비스 신청 과정에서 수집하는 정보를 투명하게 안내합니다.</p>
        </div>
      </section>
      <article className="container legal-document">
        <h2>1. 수집·이용 목적</h2>
        <p>컴퓨터 수리 서비스 접수, 상담, 방문 일정 조율, 처리 상태 안내 및 분쟁 대응을 위해 개인정보를 이용합니다.</p>
        <h2>2. 수집 항목</h2>
        <p>필수: 이름, 연락처, 우편번호, 주소, 기기 종류, 증상 및 접수 내용. 선택: 제조사·모델명, 희망 방문 일시.</p>
        <h2>3. 보유 기간</h2>
        <p>서비스 종료 후 1년을 원칙으로 하며, 관계 법령에 별도 보존 의무가 있는 경우 해당 기간 동안 보관합니다.</p>
        <h2>4. 공개 게시판</h2>
        <p>신청 현황 목록에는 이름을 마스킹하고 연락처와 상세 주소를 공개하지 않습니다. 비공개 신청 본문은 신청자가 설정한 비밀번호 확인 후에만 제공합니다.</p>
        <h2>5. 텔레그램 알림</h2>
        <p>신규 접수 알림에는 접수번호, 기기, 시·구 수준 지역, 마스킹된 이름과 연락처만 포함하며 전체 정보는 관리자 화면에서 확인합니다.</p>
        <h2>6. 파기와 안전조치</h2>
        <p>보유기간이 지난 개인정보는 복구할 수 없는 방식으로 삭제하며, 접근 제한, 비밀번호 해시, 전송구간 암호화와 관리자 활동 기록을 적용합니다.</p>
        <h2>7. 문의</h2>
        <p>개인정보 관련 문의: {config.email} / {config.phone}</p>
        <div className="legal-notice">실제 서비스 오픈 전 사업자 정보, 처리위탁·국외이전 해당 여부와 법정 보유기간을 검토해 최종 문안으로 교체해야 합니다.</div>
      </article>
    </main>
  );
}
