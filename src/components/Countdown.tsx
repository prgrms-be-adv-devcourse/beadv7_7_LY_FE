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

export function Countdown({ endsAt }: { endsAt: number }) {
    // 임박(1시간 미만)해야만 초 단위로 움직인다. 여유 구간은 1분에 한 번만 갱신 —
    // 임박 구간으로 넘어가는 시점도 최대 1분 오차로 따라잡는다
    const soonAtMount = endsAt - Date.now() < 3600_000;
    const now = useNow(soonAtMount ? 1000 : 60_000);
    const remaining = endsAt - now;
    const soon = remaining > 0 && remaining < 3600_000;
    return (
        <span
            className={`inline-flex items-center gap-1.5 font-mono text-xs font-bold tabular-nums ${
                soon ? "text-live" : "text-ink"
            }`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full ${
                    soon ? "bg-live animate-[live-pulse_1.1s_infinite] motion-reduce:animate-none" : "bg-faint"
                }`}
            />
            {soon || remaining <= 0 ? formatRemaining(remaining) : formatCoarse(remaining)}
        </span>
    );
}
