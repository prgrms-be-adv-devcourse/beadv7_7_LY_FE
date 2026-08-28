import type { AuctionStatus, BidInfo } from "../../api/auctions";
import { formatWon } from "../../components/AuctionCard";
import { formatAgo } from "../../lib/format";

export function BidLog({ entries, status }: { entries: BidInfo[]; status: AuctionStatus }) {
    if (entries.length === 0) {
        // 서버가 입찰 내역을 진행 중(RUNNING)에만 내려주므로, 그 외 상태의 빈 목록은
        // "입찰이 없다"가 아니라 "여기서 보여주지 않는다"는 뜻이다 — 문구를 상태에 맞춘다
        if (status === "SCHEDULED") {
            return <p className="px-5 py-10 text-center text-sm text-muted">경매가 시작되면 입찰 내역이 여기에 표시됩니다.</p>;
        }
        if (status !== "RUNNING") {
            return <p className="px-5 py-10 text-center text-sm text-muted">입찰 내역은 경매 진행 중에만 표시됩니다.</p>;
        }
        return <p className="px-5 py-10 text-center text-sm text-muted">아직 입찰이 없습니다. 첫 입찰자가 되어보세요.</p>;
    }
    return (
        <div>
            {entries.map((entry, i) => (
                <div
                    key={`${entry.bidder}-${entry.amount}-${i}`}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-line px-5 py-3 last:border-b-0"
                >
                    <span className="text-[13px] text-muted">{entry.bidder}</span>
                    <span className="font-mono text-sm font-bold tabular-nums">{formatWon(entry.amount)}</span>
                    <span className="min-w-[62px] text-right text-[11.5px] text-faint">{formatAgo(entry.placedAt)}</span>
                </div>
            ))}
        </div>
    );
}
