import type { Metadata } from "next";
import { ArrowRight, BookOpenText, CircuitBoard, HardDrive, ShieldCheck, Wrench } from "lucide-react";
import Link from "next/link";
import { listPublishedBlogPosts } from "@/data/blog-post-repository";
import { CONTENT_ORIGIN } from "@/lib/blog/post-contract";
import { withPublicReadFallback } from "@/lib/blog/public-read-fallback";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "수리 기록과 컴퓨터 정보",
  description: "컴박사의 수리일지, 증상 대처법, 하드웨어 소식과 추천 정보를 원문과 근거 카드로 확인하세요.",
  alternates: { canonical: `${CONTENT_ORIGIN}/insights` },
};

const LABELS = {
  repair_diary: "현장 수리일지",
  symptom_guide: "증상 해결 가이드",
  hardware_news: "하드웨어 소식",
  recommended: "컴박사 추천",
} as const;

const ICONS = {
  repair_diary: Wrench,
  symptom_guide: ShieldCheck,
  hardware_news: CircuitBoard,
  recommended: HardDrive,
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}

export default async function InsightsArchivePage() {
  const posts = await withPublicReadFallback(() => listPublishedBlogPosts(100), []);
  return (
    <main id="main-content" className="insight-archive-page">
      <section className="container insight-archive-hero">
        <span className="eyebrow">COMBAKSA KNOWLEDGE ARCHIVE</span>
        <div>
          <h1>수리 현장과 컴퓨터 지식을 한 장씩 꺼내 읽으세요.</h1>
          <p>네이버 블로그에 발행한 글을 컴박사 홈페이지의 원문·근거 기록과 연결했습니다. 지역명은 실제 수리일지에만 표시합니다.</p>
        </div>
        <dl>
          <div><dt>보관 글</dt><dd>{posts.length}건</dd></div>
          <div><dt>구성</dt><dd>원문 · 근거 · 출처</dd></div>
        </dl>
      </section>

      <section className="container insight-archive-grid" aria-label="컴박사 블로그 게시글">
        {posts.length ? posts.map((post, index) => {
          const Icon = ICONS[post.contentType];
          return (
            <article className={`insight-archive-card note-${post.contentType}${index === 0 ? " featured" : ""}`} key={post.id}>
              <div className="insight-archive-card-meta"><span><Icon size={17} aria-hidden="true" /> {LABELS[post.contentType]}</span><time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time></div>
              <h2>{post.title}</h2>
              <p>{post.excerpt || "컴박사가 확인한 작업 과정과 점검 정보를 정리했습니다."}</p>
              <div className="insight-archive-card-footer">
                <span>{post.contentType === "repair_diary" && post.district ? `${post.district} 현장 기록` : post.evidenceCards.length ? `근거 ${post.evidenceCards.length}건` : "컴박사 검토"}</span>
                <Link href={`/insights/${post.postId}`}>원문·근거 읽기 <ArrowRight size={17} aria-hidden="true" /></Link>
              </div>
            </article>
          );
        }) : (
          <div className="insight-archive-empty"><BookOpenText size={30} aria-hidden="true" /><strong>공개된 콘텐츠를 불러오고 있습니다.</strong><p>발행 이벤트와 네이버 RSS 동기화가 완료되면 카드가 표시됩니다.</p></div>
        )}
      </section>
    </main>
  );
}
