import { parseServerTime } from "../api/auctions";

// "2분 전"식 상대 시각. 오래된 기록은 상대 표기가 오히려 안 읽혀 날짜로 바꾼다
export function formatAgo(at: string): string {
    const parsed = parseServerTime(at);
    const diffMin = Math.floor((Date.now() - parsed) / 60_000);
    if (diffMin < 1) return "방금";
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간 전`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 8) return `${diffDay}일 전`;
    return new Date(parsed).toLocaleDateString("ko-KR", { year: "2-digit", month: "numeric", day: "numeric" });
}
