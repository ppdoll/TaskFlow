"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // 개발 모드: 기존 등록을 해제해 stale 캐시 문제를 방지
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((reg) => void reg.unregister()));
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 서비스워커 등록 실패는 치명적이지 않음 (오프라인 대응만 비활성화됨)
    });
  }, []);

  return null;
}
