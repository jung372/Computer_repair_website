import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  ClipboardCheck,
  Gauge,
  Headphones,
  MessageSquareText,
  PhoneCall,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { DeviceIcon } from "@/components/device-icon";
import { RequestList } from "@/components/request-list";
import { getPublicBoard } from "@/lib/logic/request-service";
import { serviceGuideList } from "@/lib/service-content";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [recent, config] = await Promise.all([getPublicBoard(), getSiteConfig()]);
  const phoneHref = `tel:${config.phone.replace(/\D/g, "")}`;

  return (
    <main id="main-content">
      <section className="hero">
        <div className="hero-grid-overlay" aria-hidden="true" />
        <div className="container hero-inner">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span className="pulse-dot" />
              온라인 접수 · 진행 조회 · 개인정보 보호
            </div>
            <h1>
              멈춘 컴퓨터,
              <br />
              <span>다시 일상으로.</span>
            </h1>
            <p>
              보이는 증상부터 알려 주세요. 원인을 단정하지 않고 차근차근 점검해
              필요한 수리 방법과 비용을 먼저 설명합니다.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary button-large" href="/requests/new">
                서비스 신청 <ArrowRight size={19} aria-hidden="true" />
              </Link>
              <a className="button button-ghost button-large" href={phoneHref}>
                <PhoneCall size={19} aria-hidden="true" /> 전화 상담
              </a>
            </div>
            <div className="hero-trust">
              <span><ShieldCheck size={16} /> 비공개 접수</span>
              <span><BadgeCheck size={16} /> 진단 후 견적</span>
              <span><MessageSquareText size={16} /> 진행상태 확인</span>
            </div>
          </div>
          <div className="hero-visual" aria-label="수리 접수 진행 예시">
            <div className="diagnostic-card">
              <div className="diagnostic-top">
                <span><span className="online-dot" /> 접수 시스템 운영 중</span>
                <Gauge size={18} aria-hidden="true" />
              </div>
              <div className="device-illustration">
                <div className="screen-frame">
                  <div className="screen-content">
                    <span className="scan-line" />
                    <Wrench size={42} aria-hidden="true" />
                    <strong>DIAGNOSIS</strong>
                    <small>증상 확인 · 안전 점검 · 견적 안내</small>
                  </div>
                </div>
                <div className="screen-stand" />
              </div>
              <div className="diagnostic-steps">
                <div className="active"><span>01</span><strong>온라인 접수</strong><small>1~2분</small></div>
                <div><span>02</span><strong>증상 상담</strong><small>운영자 확인</small></div>
                <div><span>03</span><strong>일정 확정</strong><small>방문·입고</small></div>
              </div>
            </div>
            <div className="hero-floating-card">
              <CalendarCheck2 size={22} aria-hidden="true" />
              <span><small>빠른 확인</small><strong>접수 즉시 알림</strong></span>
            </div>
          </div>
        </div>
        <div className="container hero-facts">
          <div><Headphones size={20} /><span><small>상담 시간</small><strong>{config.hours}</strong></span></div>
          <div><SearchCheck size={20} /><span><small>서비스 지역</small><strong>{config.region}</strong></span></div>
          <div><ClipboardCheck size={20} /><span><small>견적 원칙</small><strong>점검·설명 후 진행</strong></span></div>
        </div>
      </section>

      <section className="section service-section">
        <div className="container">
          <div className="section-heading split-heading">
            <div>
              <span className="eyebrow">Repair services</span>
              <h2>어떤 기기에 문제가 있나요?</h2>
            </div>
            <p>기기를 선택하면 자주 발생하는 증상과 지금 해야 할 일을 먼저 확인할 수 있습니다.</p>
          </div>
          <div className="service-grid">
            {serviceGuideList.map((guide, index) => (
              <Link
                href={`/services/${guide.slug}`}
                className={`service-card accent-${guide.accent}`}
                key={guide.slug}
              >
                <div className="service-card-top">
                  <span className="service-number">0{index + 1}</span>
                  <span className="service-icon"><DeviceIcon type={guide.slug} size={34} /></span>
                </div>
                <span className="service-english">{guide.english}</span>
                <h3>{guide.title}</h3>
                <p>{guide.summary}</p>
                <span className="card-link">주요 증상 보기 <ArrowRight size={17} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section symptom-highlight">
        <div className="container symptom-highlight-inner">
          <div className="symptom-copy">
            <span className="eyebrow eyebrow-light">Before repair</span>
            <h2>고장 직후의 행동이<br />자료와 기기를 지킵니다.</h2>
            <p>
              침수, 타는 냄새, 저장장치 이상 소음이 있으면 전원을 끄고 추가 사용을
              멈춰 주세요. 접수할 때 발생 시점과 상황을 알려 주시면 진단이 빨라집니다.
            </p>
            <Link className="button button-light" href="/requests/new">
              증상 접수하기 <ArrowRight size={18} />
            </Link>
          </div>
          <div className="symptom-checklist">
            {[
              ["전원이 켜지지 않음", "케이블 확인 후 반복 전원 금지"],
              ["물·음료를 쏟음", "전원과 충전기 즉시 분리"],
              ["딸깍거리는 이상 소음", "자료 덮어쓰기 방지를 위해 사용 중지"],
              ["타는 냄새·심한 과열", "전원 차단 후 안전한 곳에 보관"],
            ].map(([title, description]) => (
              <div key={title}>
                <Sparkles size={18} aria-hidden="true" />
                <span><strong>{title}</strong><small>{description}</small></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section process-section" id="process">
        <div className="container">
          <div className="section-heading centered">
            <span className="eyebrow">Simple process</span>
            <h2>신청부터 완료까지, 한눈에 확인하세요</h2>
            <p>전화가 어려운 순간에도 온라인으로 신청하고 진행 상태를 확인할 수 있습니다.</p>
          </div>
          <ol className="process-grid">
            {[
              ["01", "서비스 신청", "기기·증상·연락처를 입력합니다."],
              ["02", "접수 확인", "운영자가 내용을 확인하고 연락드립니다."],
              ["03", "일정·견적 안내", "방문 또는 입고 일정과 점검 기준을 설명합니다."],
              ["04", "점검·수리", "확인한 원인과 수리 선택지를 먼저 안내합니다."],
              ["05", "완료·확인", "게시판에서 처리 상태와 안내를 확인합니다."],
            ].map(([number, title, description]) => (
              <li key={number}>
                <span>{number}</span>
                <strong>{title}</strong>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section request-status-section">
        <div className="container">
          <div className="section-heading split-heading">
            <div>
              <span className="eyebrow">Live requests</span>
              <h2>최근 신청 현황</h2>
            </div>
            <Link className="text-link" href="/requests">전체 신청 현황 <ArrowRight size={16} /></Link>
          </div>
          <RequestList requests={recent.slice(0, 8)} compact />
        </div>
      </section>

      <section className="section faq-section">
        <div className="container faq-grid">
          <div className="faq-heading">
            <span className="eyebrow">Questions</span>
            <h2>신청 전에<br />많이 묻는 질문</h2>
            <p>정확한 비용은 기기와 증상 확인 후 안내합니다.</p>
          </div>
          <div className="faq-list">
            {[
              ["출장비와 수리비는 언제 확정되나요?", "접수 내용으로 기본 안내를 드리고, 현장 또는 입고 점검 후 수리 전 최종 비용을 설명합니다."],
              ["비공개 신청은 어떻게 확인하나요?", "신청 현황에서 접수번호를 찾고, 신청 시 설정한 비밀번호를 입력하면 됩니다."],
              ["중요한 자료가 있어도 수리할 수 있나요?", "가능합니다. 데이터가 중요한 경우 접수 내용에 반드시 적고, 초기화나 재설치를 먼저 하지 마세요."],
              ["접수하면 바로 방문하나요?", "온라인 접수는 방문 확정이 아닙니다. 운영자가 연락해 증상, 지역, 가능한 시간을 확인한 뒤 일정을 확정합니다."],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>{question}<span>+</span></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="container final-cta-inner">
          <div>
            <span className="eyebrow eyebrow-light">Ready when you are</span>
            <h2>지금 보이는 증상부터 알려 주세요.</h2>
            <p>접수 내용을 확인한 뒤 가능한 점검 방법과 일정을 안내합니다.</p>
          </div>
          <div>
            <Link className="button button-light button-large" href="/requests/new">
              서비스 신청 <ArrowRight size={19} />
            </Link>
            <a className="button button-outline-light button-large" href={phoneHref}>
              {config.phone}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
