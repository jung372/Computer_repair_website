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
        <p>필수: 연락처, 기본 주소, 대표 증상. 선택: 이름, 기기 종류, 상세 주소, 제조사·모델명, 상세 접수 내용 및 신청 조회 비밀번호의 해시. 이름을 입력하지 않으면 ‘미상’, 기기 종류를 선택하지 않으면 ‘미입력’으로 저장합니다.</p>
        <h2>3. 처리 법적 근거</h2>
        <p>서비스 신청자가 요청한 접수·상담·방문 조율을 수행하기 위해 필요한 정보는 개인정보 보호법 제15조 제1항 제4호의 계약 체결·이행 및 계약 체결 과정에서 정보주체 요청에 따른 조치 근거로 처리합니다. 별도 동의를 요구하지 않으며 실제 처리 근거와 안내문 버전을 접수 기록에 남깁니다.</p>
        <h2>4. 보유 기간</h2>
        <p>서비스 종료 후 1년을 원칙으로 하며, 관계 법령에 별도 보존 의무가 있는 경우 해당 기간 동안 보관합니다.</p>
        <h2>5. 내 신청 조회</h2>
        <p>전체 신청 목록은 공개하지 않습니다. 휴대전화 번호와 신청할 때 입력한 조회 비밀번호가 모두 일치하는 경우에만 10분 동안 본인의 신청을 조회할 수 있습니다. 비밀번호를 입력하지 않은 신청은 추후 직접 조회할 수 없으며, 비밀번호 원문은 저장하지 않습니다.</p>
        <h2>6. 신규접수 알림의 국외 처리</h2>
        <p>운영자의 접수 확인을 위해 Telegram Bot API로 접수번호, 기기 종류, 전체 연락처, 기본 주소와 대표 증상을 전송합니다. 이름, 상세 주소, 상세 접수 내용과 조회 비밀번호는 전송하지 않습니다.</p>
        <p>이전받는 자는 Telegram Group Inc.(영국령 버진아일랜드), Telegraph Inc.(영국령 버진아일랜드), Telegram FZ-LLC(아랍에미리트) 및 Telegram이 운영하는 국외 데이터센터입니다. 신규접수 직후 암호화된 HTTPS 방식으로 이전하며 목적은 운영자 접수 알림입니다. 운영 메시지는 전달·복사 방지 설정을 적용하고 발송 약 24시간 후 삭제를 요청합니다. Telegram의 클라우드 처리 위치와 보유 기준은 Telegram 개인정보 처리방침의 적용을 받습니다.</p>
        <h2>7. 파기와 안전조치</h2>
        <p>보유기간이 지난 개인정보는 복구할 수 없는 방식으로 삭제하며, 접근 제한, 비밀번호 해시, 전송구간 암호화와 관리자 활동 기록을 적용합니다.</p>
        <h2>8. 문의</h2>
        <p>개인정보 관련 문의: {config.email} / {config.phone}</p>
        <div className="legal-notice">Telegram 전체정보 알림은 운영자 개인 채팅, 콘텐츠 보호와 자동삭제 보호조치가 확인된 경우에만 사용합니다. 사업자 정보는 페이지 하단에서 확인할 수 있습니다.</div>
      </article>
    </main>
  );
}
