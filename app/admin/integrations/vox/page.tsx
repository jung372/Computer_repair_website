import type { Metadata } from "next";
import { Activity, CheckCircle2, CircleAlert, RadioTower } from "lucide-react";
import Link from "next/link";
import { AdminAccountNav } from "@/components/admin-account-nav";
import {
  getVoxIntegrationSummary,
  listVoxIntegrationIntakes,
} from "@/data/integration-intake-repository";
import { requireOwner } from "@/lib/admin-auth";
import { getRuntimeString } from "@/lib/runtime-config";

export const metadata: Metadata = {
  title: "전화 접수 연동 상태",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const REASON_LABELS: Record<string, string> = {
  SKIPPED_NOTICE_NOT_DELIVERED: "접수 안내 미전달",
  SKIPPED_AI_IDENTITY_NOT_DISCLOSED: "AI 상담원 고지 미완료",
  SKIPPED_NOT_CONFIRMED: "최종 접수 미동의",
  SKIPPED_ADDRESS_NOT_CONFIRMED: "주소 확인 미완료",
  SKIPPED_INVALID_CALLER: "발신번호 확인 필요",
  SKIPPED_INVALID_START_AT: "통화 시작시각 오류",
  SKIPPED_MISSING_REQUIRED: "주소 또는 증상 누락",
  SKIPPED_INVALID_ANALYSIS: "통화 분석 형식 오류",
  SKIPPED_AMBIGUOUS_ANALYSIS: "통화 분석 값 중복",
};

export default async function VoxIntegrationPage() {
  const owner = await requireOwner("/admin/integrations/vox");
  const [summary, intakes] = await Promise.all([
    getVoxIntegrationSummary(),
    listVoxIntegrationIntakes(50),
  ]);
  const configuration = [
    ["자동 접수", getRuntimeString("VOX_WEBHOOK_ENABLED").toLowerCase() === "true"],
    ["서명 키", Boolean(getRuntimeString("VOX_WEBHOOK_SECRET"))],
    ["상담원 ID", Boolean(getRuntimeString("VOX_AGENT_ID"))],
    ["수신 번호", Boolean(getRuntimeString("VOX_INBOUND_NUMBER"))],
  ] as const;
  const configured = configuration.every(([, ready]) => ready);

  return (
    <main id="main-content" className="admin-shell">
      <section className="admin-top">
        <div className="container admin-top-inner">
          <div>
            <span className="eyebrow eyebrow-light">Call intake monitor</span>
            <h1>전화 접수 연동 상태</h1>
            <p>Vox 통화가 서비스 신청으로 처리된 결과만 확인합니다.</p>
          </div>
          <AdminAccountNav user={owner} />
        </div>
      </section>

      <section className="container admin-content admin-integration-content">
        <section className={`integration-health ${configured ? "ready" : "warning"}`}>
          <span className="integration-health-icon">
            {configured ? <RadioTower aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
          </span>
          <div>
            <span>현재 설정</span>
            <h2>{configured ? "웹훅 수신 준비 완료" : "필수 설정 확인 필요"}</h2>
            <p>마지막 수신: {summary.latestReceivedAt ? formatDateTime(summary.latestReceivedAt) : "기록 없음"}</p>
          </div>
          <ul aria-label="연동 설정 점검">
            {configuration.map(([label, ready]) => (
              <li className={ready ? "ready" : "missing"} key={label}>
                {ready ? <CheckCircle2 size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
                {label}
              </li>
            ))}
          </ul>
        </section>

        <section className="integration-summary" aria-label="최근 30일 전화 접수 집계">
          <article><span>수신 합계</span><strong>{summary.total}</strong><small>최근 30일</small></article>
          <article className="created"><span>신청 생성</span><strong>{summary.created}</strong><small>접수내역에 등록</small></article>
          <article className="skipped"><span>생성 제외</span><strong>{summary.skipped}</strong><small>동의·필수정보 기준</small></article>
        </section>

        <section className="integration-log-panel">
          <header>
            <div>
              <span className="eyebrow">Processing history</span>
              <h2>최근 처리 내역</h2>
            </div>
            <p>최대 50건 · 새 통화 후 자동 갱신</p>
          </header>

          {intakes.length ? (
            <div className="admin-table-wrap integration-table-wrap">
              <table className="admin-table integration-table">
                <thead><tr><th>수신 시각</th><th>결과</th><th>처리 사유</th><th>상담원 버전</th><th>접수 연결</th></tr></thead>
                <tbody>
                  {intakes.map((intake) => (
                    <tr key={intake.id}>
                      <td>{formatDateTime(intake.receivedAt)}</td>
                      <td><IntegrationStatus status={intake.status} /></td>
                      <td>{intake.reasonCode ? REASON_LABELS[intake.reasonCode] ?? intake.reasonCode : "정상 생성"}</td>
                      <td>{intake.agentVersion || "확인 불가"}</td>
                      <td>
                        {intake.publicId ? (
                          <Link className="admin-customer-link" href={`/admin/requests/${intake.publicId}`}>{intake.publicId}</Link>
                        ) : (
                          <span className="integration-muted">생성 안 됨</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="integration-empty">
              <Activity aria-hidden="true" />
              <strong>아직 수신 기록이 없습니다.</strong>
              <p>테스트 통화를 마친 뒤 이 페이지를 새로고침해 주세요.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function IntegrationStatus({ status }: { status: string }) {
  const created = status === "CREATED";
  return (
    <span className={`integration-status ${created ? "created" : "skipped"}`}>
      {created ? <CheckCircle2 size={14} aria-hidden="true" /> : <CircleAlert size={14} aria-hidden="true" />}
      {created ? "신청 생성" : "생성 제외"}
    </span>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
