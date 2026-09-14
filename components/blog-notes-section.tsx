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
    name: "컴박사 수리·컴퓨터 정보",
    itemListElement: posts.map((post, index) => ({
      "@type": "ListItem", position: index + 1, url: post.canonicalUrl, name: post.title,
    })),
  } : null;

  return (
    <section className="blog-notes-section" id="repair-cases" aria-labelledby="blog-notes-heading">
      {itemList ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} /> : null}
      <div className="container">
        <div className="blog-notes-heading">
          <div><span className="eyebrow">COMBAKSA KNOWLEDGE</span><h2 id="blog-notes-heading">수리 기록과 컴퓨터 정보를 한곳에서</h2></div>
          <p>현장 수리일지부터 증상 대처법, 하드웨어 소식까지 컴박사가 확인한 본문과 근거를 함께 읽을 수 있습니다.</p>
        </div>
        <div className="content-ledger-strip" aria-label="컴박사 콘텐츠 연결 원칙">
          <span><strong>전체 원문</strong><small>홈페이지에 보관</small></span>
          <span><strong>근거 카드</strong><small>출처와 판단 연결</small></span>
          <span><strong>네이버 발행</strong><small>채널형 글로 연결</small></span>
        </div>
        {posts.length ? (
          <div className={`blog-notes-grid blog-notes-count-${Math.min(posts.length, 6)}`}>
            {posts.map((post, index) => {
              const Icon = ICONS[post.contentType];
              return (
                <article className={`blog-note-card note-${post.contentType}${index === 0 ? " featured" : ""}`} key={post.id}>
                  <div className="blog-note-index" aria-hidden="true">COMBAKSA / {String(index + 1).padStart(2, "0")}</div>
                  <div className="blog-note-meta"><span><Icon size={16} aria-hidden="true" /> {LABELS[post.contentType]}</span><time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time></div>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt || "컴박사가 확인한 작업 과정과 점검 방법을 정리했습니다."}</p>
                  <div className="blog-note-footer">
                    {post.contentType === "repair_diary" && post.district ? <span>{post.district} 현장 기록</span> : <span>{post.evidenceCards.length ? `근거 ${post.evidenceCards.length}건` : "컴박사 검토"}</span>}
                    <Link href={`/insights/${post.postId}`}>원문 읽어보기 <ArrowRight size={17} aria-hidden="true" /></Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="blog-notes-empty"><CircuitBoard size={28} aria-hidden="true" /><div><strong>첫 콘텐츠를 정리하고 있습니다.</strong><p>수리 기록과 컴퓨터 정보를 검토한 뒤 원문과 근거를 함께 공개합니다.</p></div></div>
        )}
        <div className="blog-notes-actions">
          <Link className="button button-primary" href="/insights">모든 글 카드로 보기 <ArrowRight size={18} aria-hidden="true" /></Link>
          <Link className="blog-notes-all" href="/requests/new">수리 신청</Link>
          <a className="blog-notes-all" href={blogUrl} target="_blank" rel="noopener noreferrer">컴박사 블로그 전체 보기 <ArrowUpRight size={18} aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}
