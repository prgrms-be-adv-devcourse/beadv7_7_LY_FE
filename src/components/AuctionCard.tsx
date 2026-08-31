import { Link } from "react-router";
import { formatCondition, parseServerTime, type AuctionListItem } from "../api/auctions";
import { Countdown } from "./Countdown";
import { VinylCover } from "./VinylCover";
import { WatchButton } from "./WatchButton";

export function formatWon(n: number): string {
    return "₩" + n.toLocaleString("ko-KR");
}

// 커버 왼쪽 위 상태 칩. RUNNING만 카운트다운이 돌고, 나머지는 상태 문구다
const STATUS_CHIPS: Record<string, { label: string; className: string }> = {
    SCHEDULED: { label: "시작 전", className: "bg-brand text-white" },
    ENDED_WON: { label: "종료", className: "bg-ink/60 text-white" },
    ENDED_FAILED: { label: "유찰", className: "bg-ink/60 text-white" },
    CLOSING: { label: "처리 중", className: "bg-amber/90 text-white" },
    CANCELED: { label: "취소됨", className: "bg-ink/60 text-white" },
    FORCE_CANCELED: { label: "관리자 취소", className: "bg-ink/60 text-white" },
};

// 상태별 가격 라벨과 색 — 낙찰가만 초록으로 구분한다
function priceMeta(auction: AuctionListItem): { label: string; className: string } {
    if (auction.status === "ENDED_WON") return { label: "낙찰가", className: "text-up" };
    if (auction.status === "ENDED_FAILED") return { label: "시작가", className: "text-muted" };
    return auction.bidCount > 0 ? { label: "현재가", className: "text-ink" } : { label: "시작가", className: "text-ink" };
}

export function AuctionCard({ auction, className = "" }: { auction: AuctionListItem; className?: string }) {
    const chip = STATUS_CHIPS[auction.status];
    const ended = auction.status !== "RUNNING" && auction.status !== "SCHEDULED";
    const price = priceMeta(auction);
    return (
        <Link to={`/auctions/${auction.auctionId}`} className={`group min-w-0 ${className}`}>
            <div className="relative overflow-hidden rounded-xl shadow-[0_2px_10px_rgba(35,36,31,0.09)] transition-transform duration-200 group-hover:-translate-y-1">
                <VinylCover title={auction.title} artist={auction.artistName} imageUrl={auction.thumbnail} />
                {/* 종료된 카드는 커버를 옅게 눌러 진행 중과 한눈에 구분한다 */}
                {ended && <div className="absolute inset-0 z-[1] bg-paper/40" />}
                {chip && (
                    <span className={`absolute left-2 top-2 z-[2] rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${chip.className}`}>
                        {chip.label}
                    </span>
                )}
                <WatchButton auctionId={auction.auctionId} status={auction.status} />
            </div>
            <p className="mt-2 truncate text-[13.5px] font-bold">{auction.title}</p>
            <p className="truncate text-[12px] font-semibold text-muted">
                {auction.artistName}
                {auction.releaseYear ? ` · ${auction.releaseYear}` : ""}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-faint">
                {auction.itemCondition && (
                    <span className="rounded-md bg-surface2 px-1.5 py-px font-extrabold text-muted">
                        {formatCondition(auction.itemCondition).split(" ")[0]}
                    </span>
                )}
                <span>{auction.bidCount > 0 ? `입찰 ${auction.bidCount}회` : "입찰 전"}</span>
                {auction.status === "RUNNING" && (
                    <span className="ml-auto">
                        <Countdown endsAt={parseServerTime(auction.endAt)} />
                    </span>
                )}
                {auction.status === "SCHEDULED" && (
                    <span className="ml-auto inline-flex items-center gap-1">
                        시작까지 <Countdown endsAt={parseServerTime(auction.startAt)} expiredLabel="곧 시작" />
                    </span>
                )}
            </p>
            <p className="mt-1.5 flex items-baseline gap-1.5">
                <b className={`font-mono text-[14.5px] font-bold tabular-nums ${price.className}`}>
                    {formatWon(auction.finalPrice)}
                </b>
                <small className="text-[10.5px] font-bold text-faint">{price.label}</small>
            </p>
        </Link>
    );
}
