"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export function MarketingStatusRefresh({ hasActiveJobs }: { hasActiveJobs: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden && !pending) startTransition(() => router.refresh());
    };
    const intervalMs = hasActiveJobs ? 30_000 : 300_000;
    const timer = setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [hasActiveJobs, router, pending]);
  return <div><button type="button" className="button secondary" disabled={pending}
    onClick={() => startTransition(() => router.refresh())}>{pending ? "확인 중…" : "상태 새로고침"}</button>
    <small> {hasActiveJobs ? "진행 중에는 30초" : "대기 중에는 5분"}마다 자동 갱신 · 필요하면 버튼으로 바로 확인할 수 있습니다.</small></div>;
}
