import type { Metadata } from "next";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { DeviceIcon } from "@/components/device-icon";
import { serviceGuideList } from "@/lib/service-content";

export const metadata: Metadata = {
  title: "수리 서비스",
  description: "컴퓨터, 노트북, 모니터, 애플기기의 주요 고장 증상과 점검 안내.",
};

export default function ServicesPage() {
  return (
    <main id="main-content">
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow eyebrow-light">Repair services</span>
          <h1>기기별 수리 서비스</h1>
          <p>비슷한 증상을 선택하면 가능한 원인과 지금 해야 할 일을 확인할 수 있습니다.</p>
        </div>
      </section>
      <section className="section">
        <div className="container service-detail-list">
          {serviceGuideList.map((guide) => (
            <article className={`service-detail-preview accent-${guide.accent}`} key={guide.slug}>
              <div className="service-detail-preview-icon"><DeviceIcon type={guide.slug} size={42} /></div>
              <div>
                <span>{guide.english}</span>
                <h2>{guide.title}</h2>
                <p>{guide.summary}</p>
                <ul>
                  {guide.symptoms.slice(0, 3).map((symptom) => (
                    <li key={symptom.id}><CheckCircle2 size={16} /> {symptom.title}</li>
                  ))}
                </ul>
              </div>
              <Link className="button button-secondary" href={`/services/${guide.slug}`}>
                자세히 보기 <ArrowRight size={17} />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
