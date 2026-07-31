import type { Metadata } from "next";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeviceIcon } from "@/components/device-icon";
import { deviceGuides } from "@/lib/service-content";

type Props = { params: Promise<{ device: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { device } = await params;
  const guide = deviceGuides[device as keyof typeof deviceGuides];
  return guide
    ? { title: guide.title, description: guide.summary }
    : { title: "수리 서비스" };
}

export default async function DeviceServicePage({ params }: Props) {
  const { device } = await params;
  const guide = deviceGuides[device as keyof typeof deviceGuides];
  if (!guide) notFound();

  return (
    <main id="main-content">
      <section className={`device-page-hero accent-${guide.accent}`}>
        <div className="container device-page-hero-inner">
          <div>
            <div className="breadcrumbs">
              <Link href="/">홈</Link><ChevronRight size={14} /><Link href="/services">수리 서비스</Link>
            </div>
            <span className="eyebrow">{guide.english}</span>
            <h1>{guide.title}</h1>
            <p>{guide.summary}</p>
            <Link className="button button-primary" href={`/requests/new?device=${guide.slug}`}>
              이 서비스로 신청하기 <ArrowRight size={18} />
            </Link>
          </div>
          <span className="device-page-icon"><DeviceIcon type={guide.slug} size={88} /></span>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <div className="section-heading split-heading">
            <div>
              <span className="eyebrow">Common symptoms</span>
              <h2>자주 발생하는 증상</h2>
            </div>
            <p>아래 내용은 일반적인 가능성입니다. 정확한 원인은 실제 점검 후 안내합니다.</p>
          </div>
          <div className="symptom-guide-grid">
            {guide.symptoms.map((symptom, index) => (
              <article key={symptom.id} className="symptom-guide-card">
                <span className="symptom-index">0{index + 1}</span>
                <h3>{symptom.title}</h3>
                <div>
                  <strong><CheckCircle2 size={17} /> 가능한 원인</strong>
                  <p>{symptom.cause}</p>
                </div>
                <div className="symptom-action">
                  <strong><AlertTriangle size={17} /> 지금 할 일</strong>
                  <p>{symptom.action}</p>
                </div>
                <Link
                  className="card-link"
                  href={`/requests/new?device=${guide.slug}&symptom=${encodeURIComponent(symptom.title)}`}
                >
                  이 증상으로 신청 <ArrowRight size={17} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="service-notice">
        <div className="container">
          <AlertTriangle size={24} />
          <div>
            <strong>데이터가 중요하다면 먼저 알려 주세요.</strong>
            <p>부팅 실패나 저장장치 이상이 있을 때 초기화·재설치를 반복하면 복구 가능성이 낮아질 수 있습니다.</p>
          </div>
          <Link className="button button-light" href={`/requests/new?device=${guide.slug}`}>서비스 신청</Link>
        </div>
      </section>
    </main>
  );
}
