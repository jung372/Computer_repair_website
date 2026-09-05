"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export function MarketingStatusRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden && !pending) startTransition(() => router.refresh());
    };
    const timer = setInterval(refresh, 10000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [router, pending]);
  return <div><button type="button" className="button secondary" disabled={pending}
    onClick={() => startTransition(() => router.refresh())}>{pending ? "확인 중…" : "상태 새로고침"}</button>
    <small> 10초마다 자동 갱신 · 서버 동기화 시각이 오래되면 서버 연결 상태를 확인하세요.</small></div>;
}
