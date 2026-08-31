import { useEffect, useState } from "react";

export function formatRemaining(ms: number): string {
    if (ms <= 0) return "종료";
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    if (days > 0) return `${days}일 ${pad(hours)}:${pad(minutes)}`;
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function useNow(intervalMs = 1000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(timer);
    }, [intervalMs]);
    return now;
}

// 여유 있는 시간은 "7시간"처럼 뭉뚱그린다 — 모든 카드가 초 단위로 움직이면
// 진짜 임박한 것이 안 보이고, 매초 리렌더 비용만 든다
function formatCoarse(ms: number): string {
    const totalMin = Math.floor(ms / 60_000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    if (days > 0) return hours > 0 ? `${days}일 ${hours}시간` : `${days}일`;
    return `${hours}시간`;
}

// expiredLabel: 시각이 지났을 때 보여줄 문구. 종료 카운트다운이면 기본값 그대로, 시작 카운트다운이면
// "곧 시작"처럼 바꿔 쓴다 — 시작 시각이 지나도 스케줄러가 상태를 옮기기 전까지는 SCHEDULED로 남기 때문
export function Countdown({ endsAt, expiredLabel = "종료" }: { endsAt: number; expiredLabel?: string }) {
    // 1일 이내면 초까지 보여주므로 초 단위로 움직인다 (팀 결정 — 화면당 카드 수가 적어 리렌더 부담 없음).
    // 1일 이상 남은 것은 "N일 N시간"이라 1분에 한 번만 갱신한다
    const detailedAtMount = endsAt - Date.now() < 86_400_000;
    const now = useNow(detailedAtMount ? 1000 : 60_000);
    const remaining = endsAt - now;
    // 초 표시는 1일 이내부터, 주황 강조는 1시간 이내부터 — 표시 정밀도와 임박 경고를 분리한다
    const detailed = remaining > 0 && remaining < 86_400_000;
    const soon = remaining > 0 && remaining < 3600_000;
    return (
        <span
            className={`inline-flex items-center gap-1 font-mono text-xs font-bold tabular-nums ${
                soon ? "text-live" : "text-ink"
            }`}
        >
            <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-3 w-3 ${
                    soon
                        ? "text-live animate-[live-pulse_1.1s_infinite] motion-reduce:animate-none"
                        : "text-faint"
                }`}
            >
                <circle cx="12" cy="12" r="8.6" />
                <path d="M12 7.6v4.7l3 1.7" />
            </svg>
            {remaining <= 0 ? expiredLabel : detailed ? formatRemaining(remaining) : formatCoarse(remaining)}
        </span>
    );
}
