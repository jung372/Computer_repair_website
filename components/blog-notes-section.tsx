import { ArrowUpRight, CircuitBoard, HardDrive, ShieldCheck, Wrench } from "lucide-react";
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
    name: "컴박사 최신 수리 노트",
    itemListElement: posts.map((post, index) => ({
      "@type": "ListItem", position: index + 1, url: post.postUrl, name: post.title,
    })),
  } : null;

  return (
    <section className="blog-notes-section" aria-labelledby="blog-notes-heading">
      {itemList ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} /> : null}
      <div className="container">
        <div className="blog-notes-heading">
          <div><span className="eyebrow">Repair notes</span><h2 id="blog-notes-heading">컴박사가 직접 정리한 수리 노트</h2></div>
          <p>실제 수리 사례와 집에서 먼저 확인할 수 있는 점검 방법을 기록합니다.</p>
        </div>
        {posts.length ? (
          <div className={`blog-notes-grid blog-notes-count-${Math.min(posts.length, 3)}`}>
            {posts.map((post, index) => {
              const Icon = ICONS[post.contentType];
              return (
                <article className={`blog-note-card note-${post.contentType}`} key={post.id}>
                  <div className="blog-note-index" aria-hidden="true">LOG {String(index + 1).padStart(2, "0")}</div>
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
          <div className="blog-notes-empty"><CircuitBoard size={28} aria-hidden="true" /><div><strong>수리 기록을 정리하고 있습니다.</strong><p>현재 공개된 글은 컴박사 블로그에서 먼저 확인할 수 있습니다.</p></div></div>
        )}
        <a className="blog-notes-all" href={blogUrl} target="_blank" rel="noopener noreferrer">컴박사 블로그 전체 보기 <ArrowUpRight size={18} aria-hidden="true" /></a>
      </div>
    </section>
  );
}
