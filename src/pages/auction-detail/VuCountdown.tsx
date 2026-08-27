import { formatRemaining, useNow } from "../../components/Countdown";

const HOUR = 3600_000;

// "오늘 21:40 마감"처럼 절대 마감 시각을 붙인다 — 남은 시간만으로는 몇 시에 끝나는지 알 수 없어서
function formatEndsAt(endsAt: number, now: number): string {
    const end = new Date(endsAt);
    const time = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const dayDiff = Math.floor((endsAt - startOfToday.getTime()) / 86_400_000);
    if (dayDiff === 0) return `오늘 ${time} 마감`;
    if (dayDiff === 1) return `내일 ${time} 마감`;
    return `${end.getMonth() + 1}/${end.getDate()} ${time} 마감`;
}

// VU미터 바늘이 경매 진행률(시작→마감)을 가리킨다. 왼쪽 게이지 + 오른쪽 숫자의 계기판형 —
// 바늘 이동 범위와 숫자 영역을 분리해 겹침이 없다. 호 오른쪽 끝 15%는 레드존으로,
// 바늘이 들어가면 임박이라는 게 색과 형태로 읽힌다
export function VuCountdown({ startedAt, endsAt }: { startedAt: number; endsAt: number }) {
    const now = useNow();
    const total = Math.max(1, endsAt - startedAt);
    const elapsed = Math.min(Math.max(now - startedAt, 0), total);
    const ratio = elapsed / total;
    const remaining = endsAt - now;
    // 카드 카운트다운과 같은 규칙 — 1시간 미만부터 임박 상태
    const hot = remaining > 0 && remaining < HOUR;
    // 바늘 각도: 수직 기준 -72°(시작, 왼쪽) → +72°(마감, 오른쪽)
    const angleRad = ((-72 + ratio * 144) * Math.PI) / 180;
    const needleX = 100 + 62 * Math.sin(angleRad);
    const needleY = 84 - 62 * Math.cos(angleRad);
    const stroke = hot ? "var(--color-live)" : "var(--color-ink)";

    return (
        <div
            className={`mt-4 flex items-center gap-3.5 rounded-xl border px-3.5 py-3 ${
                hot ? "border-live bg-live-bg" : "border-line bg-surface2"
            }`}
        >
            <svg
                viewBox="0 14 200 76"
                role="img"
                aria-label="마감까지 남은 시간 게이지"
                className="w-[104px] flex-none"
            >
                <path
                    d="M 30 84 A 74 74 0 0 1 170 84"
                    fill="none"
                    stroke="var(--color-line-strong)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    opacity={hot ? 0.6 : 1}
                />
                <path
                    d="M 30 84 A 74 74 0 0 1 170 84"
                    fill="none"
                    stroke="var(--color-live)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray="0 197.5 35"
                    opacity={hot ? 0.35 : 0.28}
                />
                <path
                    d="M 30 84 A 74 74 0 0 1 170 84"
                    fill="none"
                    stroke={hot ? "var(--color-live)" : "var(--color-amber)"}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${ratio * 232} 232`}
                />
                <line x1="100" y1="84" x2={needleX.toFixed(1)} y2={needleY.toFixed(1)} stroke={stroke} strokeWidth="3" opacity={hot ? 1 : 0.85} />
                <circle
                    cx="100"
                    cy="84"
                    r="6"
                    fill={stroke}
                    className={hot ? "animate-[live-pulse_1.1s_infinite] motion-reduce:animate-none" : ""}
                />
            </svg>
            <div className="min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-[0.1em] ${hot ? "text-live" : "text-faint"}`}>
                    {/* 시각이 지나면 아래 숫자가 "종료"로 바뀌므로 "마감까지 종료"가 되지 않게 라벨을 줄인다 */}
                    {remaining <= 0 ? "마감" : "마감까지"}
                </p>
                <p className={`font-mono text-[22px] font-bold tabular-nums ${hot ? "text-live" : "text-ink"}`}>
                    {formatRemaining(remaining)}
                </p>
                <p className={`text-[11.5px] font-semibold ${hot ? "text-live" : "text-muted"}`}>
                    {formatEndsAt(endsAt, now)}
                </p>
            </div>
        </div>
    );
}
