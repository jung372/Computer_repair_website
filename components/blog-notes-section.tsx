import { ArrowRight, ArrowUpRight, CircuitBoard, HardDrive, ShieldCheck, Wrench } from "lucide-react";
import Link from "next/link";
import type { BlogPostRow } from "@/data/blog-post-repository";

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
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" })
    .format(new Date(value));
}
export function BlogNotesSection({ posts, blogUrl }: { posts: BlogPostRow[]; blogUrl: string }) {
  const itemList = posts.length ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "컴박사 실제 수리사례",
    itemListElement: posts.map((post, index) => ({
      "@type": "ListItem", position: index + 1, url: post.postUrl, name: post.title,
    })),
  } : null;

  return (
    <section className="blog-notes-section" id="repair-cases" aria-labelledby="blog-notes-heading">
      {itemList ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} /> : null}
      <div className="container">
        <div className="blog-notes-heading">
          <div><span className="eyebrow">Repair cases</span><h2 id="blog-notes-heading">실제 수리 과정을 확인하세요</h2></div>
          <p>광진구·성동구·동대문구 현장에서 확인한 사실을 바탕으로 수리 전후 과정을 기록합니다.</p>
        </div>
        <ol className="repair-case-flow" aria-label="수리사례 기록 원칙">
          <li><span>01</span><strong>접수 증상</strong></li>
          <li><span>02</span><strong>확인한 원인</strong></li>
          <li><span>03</span><strong>실제 조치</strong></li>
          <li><span>04</span><strong>작동 확인</strong></li>
        </ol>
        {posts.length ? (
          <div className={`blog-notes-grid blog-notes-count-${Math.min(posts.length, 3)}`}>
            {posts.map((post, index) => {
              const Icon = ICONS[post.contentType];
              return (
                <article className={`blog-note-card note-${post.contentType}`} key={post.id}>
                  <div className="blog-note-index" aria-hidden="true">CASE {String(index + 1).padStart(2, "0")}</div>
                  <div className="blog-note-meta"><span><Icon size={16} aria-hidden="true" /> {LABELS[post.contentType]}</span><time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time></div>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt || "컴박사 블로그에서 작업 과정과 점검 방법을 확인하세요."}</p>
                  <div className="blog-note-footer">
                    {post.contentType === "repair_diary" && post.district ? <span>{post.district}</span> : <span>컴퓨터 수리 정보</span>}
                    <a href={post.postUrl} target="_blank" rel="noopener noreferrer">글 읽어보기 <ArrowUpRight size={17} aria-hidden="true" /></a>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="blog-notes-empty"><CircuitBoard size={28} aria-hidden="true" /><div><strong>첫 수리사례를 정리하고 있습니다.</strong><p>접수 증상부터 실제 조치와 작동 확인까지 검토한 뒤 공개합니다.</p></div></div>
        )}
        <div className="blog-notes-actions">
          <Link className="button button-primary" href="/requests/new">비슷한 증상 수리 신청 <ArrowRight size={18} aria-hidden="true" /></Link>
          <a className="blog-notes-all" href={blogUrl} target="_blank" rel="noopener noreferrer">컴박사 블로그 전체 보기 <ArrowUpRight size={18} aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}
