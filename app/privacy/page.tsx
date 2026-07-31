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
        <p>필수: 연락처, 기본 주소, 기기 종류, 증상, 접수 내용 및 신청 조회 비밀번호의 해시. 선택: 이름, 상세 주소, 제조사·모델명. 이름을 입력하지 않으면 ‘미상’으로 저장합니다.</p>
        <h2>3. 보유 기간</h2>
        <p>서비스 종료 후 1년을 원칙으로 하며, 관계 법령에 별도 보존 의무가 있는 경우 해당 기간 동안 보관합니다.</p>
        <h2>4. 내 신청 조회</h2>
        <p>전체 신청 목록은 공개하지 않습니다. 휴대전화 번호와 신청 비밀번호가 모두 일치하는 경우에만 10분 동안 본인의 신청을 조회할 수 있습니다.</p>
        <h2>5. 텔레그램 알림</h2>
        <p>신규 접수 알림에는 접수번호, 기기, 시·구 수준 지역, 마스킹된 이름과 연락처만 포함하며 전체 정보는 관리자 화면에서 확인합니다.</p>
        <h2>6. 파기와 안전조치</h2>
        <p>보유기간이 지난 개인정보는 복구할 수 없는 방식으로 삭제하며, 접근 제한, 비밀번호 해시, 전송구간 암호화와 관리자 활동 기록을 적용합니다.</p>
        <h2>7. 문의</h2>
        <p>개인정보 관련 문의: {config.email} / {config.phone}</p>
        <div className="legal-notice">처리위탁·국외이전 해당 여부와 법정 보유기간은 운영 상황에 맞게 계속 검토합니다. 사업자 정보는 페이지 하단에서 확인할 수 있습니다.</div>
      </article>
    </main>
  );
}
