import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedBlogPost } from "@/data/blog-post-repository";
import { CONTENT_ORIGIN } from "@/lib/blog/post-contract";
import { withPublicReadFallback } from "@/lib/blog/public-read-fallback";

type PageProps = { params: Promise<{ postId: string }> };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" })
    .format(new Date(value));
}

function articleBlocks(article: string, fallback: string) {
  const text = (article || fallback).replace(/\r\n?/g, "\n").trim();
  return text.split(/\n{2,}/).flatMap((block, index) => {
    const value = block.trim();
    if (!value || /^\[IMAGE INSERT\s*-\s*\d+\]$/i.test(value)) return [];
    const section = value.match(/^\[SECTION\s*-\s*([^\]]+)\]\s*\n?([\s\S]*)$/i);
    if (section) return [
      <section className="insight-section" key={`section-${index}`}>
        <h2>{section[1].trim()}</h2>
        {section[2].trim() ? <p>{section[2].trim()}</p> : null}
      </section>,
    ];
    const marker = value.match(/^\[(컴박사 전문가 팁|컴박사 안내)\]\s*\n?([\s\S]*)$/);
    if (marker) return [
      <aside className={`insight-callout ${marker[1].includes("전문가") ? "expert" : "business"}`} key={`callout-${index}`}>
        <h2>{marker[1]}</h2>
        {marker[2].trim() ? <p>{marker[2].trim()}</p> : null}
      </aside>,
    ];
    return [<p key={`paragraph-${index}`}>{value}</p>];
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { postId } = await params;
  const post = /^\d{6,}$/.test(postId)
    ? await withPublicReadFallback(() => getPublishedBlogPost(postId), null)
    : null;
  if (!post) return { title: "콘텐츠를 찾을 수 없습니다" };
  const canonical = `${CONTENT_ORIGIN}/insights/${post.postId}`;
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical },
    openGraph: { title: post.title, description: post.excerpt, type: "article", url: canonical },
  };
}

export default async function InsightPage({ params }: PageProps) {
  const { postId } = await params;
  if (!/^\d{6,}$/.test(postId)) notFound();
  const post = await withPublicReadFallback(() => getPublishedBlogPost(postId), null);
  if (!post) notFound();
  const canonicalUrl = `${CONTENT_ORIGIN}/insights/${post.postId}`;
  const sourceById = new Map(post.sources.map((source) => [source.sourceId, source]));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.syncedAt,
    mainEntityOfPage: canonicalUrl,
    author: { "@type": "Organization", name: "컴박사", url: CONTENT_ORIGIN },
    publisher: { "@type": "Organization", name: "컴박사", url: CONTENT_ORIGIN },
    citation: post.sources.map((source) => source.url),
  };

  return (
    <main id="main-content" className="insight-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="container insight-article">
        <nav className="insight-breadcrumb" aria-label="현재 위치"><Link href="/">홈</Link><span>/</span><Link href="/insights">수리·정보</Link></nav>
        <header className="insight-header">
          <span className="eyebrow">COMBAKSA KNOWLEDGE</span>
          <h1>{post.title}</h1>
          <p className="insight-lead">{post.excerpt}</p>
          <div className="insight-meta"><span>컴박사 작업팀</span><time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>{post.district ? <span>{post.district}</span> : null}</div>
        </header>
        <div className="insight-body">{articleBlocks(post.article, post.excerpt)}</div>

        {post.evidenceCards.length ? (
          <section className="evidence-section" aria-labelledby="evidence-heading">
            <div><span className="eyebrow">EVIDENCE CARDS</span><h2 id="evidence-heading">이 글의 근거 카드</h2><p>본문의 주요 판단과 이를 뒷받침하는 확인 자료를 연결했습니다.</p></div>
            <ol>{post.evidenceCards.map((card, index) => {
              const source = sourceById.get(card.sourceId);
              return <li key={`${card.sourceId}-${index}`}><strong>{card.claim}</strong><p>{card.supportingText}</p>{source ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.publisher || source.title} 원문 확인</a> : null}</li>;
            })}</ol>
          </section>
        ) : null}

        {post.sources.length ? (
          <section className="insight-sources" aria-labelledby="source-heading"><h2 id="source-heading">확인한 출처</h2><ol>{post.sources.map((source) => <li key={source.sourceId}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>{source.checkedAt ? <small>확인 {formatDate(source.checkedAt)}</small> : null}</li>)}</ol></section>
        ) : null}

        <footer className="insight-footer"><p>네이버 블로그에서 발행된 채널형 글도 함께 확인할 수 있습니다.</p><a className="button button-primary" href={post.postUrl} target="_blank" rel="noopener noreferrer">네이버 블로그 글 보기</a></footer>
      </article>
    </main>
  );
}
