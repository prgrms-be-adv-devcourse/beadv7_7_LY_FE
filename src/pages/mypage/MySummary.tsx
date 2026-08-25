import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchHostedAuctions, fetchParticipatedAuctions } from "../../api/auctions";
import { fetchOrders } from "../../api/orders";
import { getWalletBalance } from "../../api/wallet";
import { formatWon } from "../../components/AuctionCard";
import type { TabValue } from "../MyPage";

// 입찰 중·판매 중 집계는 첫 페이지 표본으로 계산한다 — 진행 중 경매가 이보다 많은
// 계정은 드물고, 전수 집계 API가 생기면 그때 교체
const SUMMARY_SAMPLE = 50;

interface MySummaryProps {
    onSelect: (tab: TabValue) => void;
}

// 탭 위 요약 스트립 — 들어오자마자 "지금 처리할 것"이 보이게 한다.
// 결제 대기는 낙찰 후 미결제가 신뢰를 깨는 1순위 지점이라 경고색으로 승격
export function MySummary({ onSelect }: MySummaryProps) {
    const pendingOrders = useQuery({
        queryKey: ["orders", "BUYER", "PENDING", 0],
        queryFn: () => fetchOrders({ perspective: "BUYER", status: "PENDING", page: 0, size: 1 }),
    });
    const participated = useQuery({
        queryKey: ["auctions", "participated", "summary"],
        queryFn: () => fetchParticipatedAuctions(0, SUMMARY_SAMPLE),
    });
    const hosted = useQuery({
        queryKey: ["auctions", "hosted", "summary"],
        queryFn: () => fetchHostedAuctions(0, SUMMARY_SAMPLE),
    });
    const balance = useQuery({ queryKey: ["wallet", "balance"], queryFn: getWalletBalance });

    const pendingCount = pendingOrders.data?.totalElements;
    const bidding = participated.data?.items.filter((a) => a.status === "RUNNING");
    const topCount = bidding?.filter((a) => a.myOutcome === "ACTIVE").length;
    const outbidCount = bidding?.filter((a) => a.myOutcome === "OUTBID").length;
    const selling = hosted.data?.items.filter((a) => a.status === "RUNNING");
    const sellingBids = selling?.reduce((acc, a) => acc + a.bidCount, 0);

    const hasPending = (pendingCount ?? 0) > 0;

    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryCell
                label="결제 대기"
                value={pendingCount === undefined ? "—" : `${pendingCount}건`}
                sub={hasPending ? "배송지 입력·결제가 필요합니다 →" : "처리할 주문이 없습니다"}
                alert={hasPending}
                onClick={() => onSelect("orders")}
            />
            <SummaryCell
                label="입찰 중"
                value={bidding === undefined ? "—" : `${bidding.length}건`}
                sub={
                    bidding === undefined || bidding.length === 0 ? (
                        "참여한 경매 →"
                    ) : (
                        <>
                            <b className="font-bold text-up">최고 {topCount}</b> ·{" "}
                            <b className={`font-bold ${outbidCount ? "text-live" : ""}`}>밀림 {outbidCount}</b>
                        </>
                    )
                }
                onClick={() => onSelect("participated")}
            />
            <SummaryCell
                label="판매 중"
                value={selling === undefined ? "—" : `${selling.length}건`}
                sub={selling && selling.length > 0 ? `입찰 ${sellingBids}회` : "등록한 경매 →"}
                onClick={() => onSelect("hosted")}
            />
            <SummaryCell
                label="예치금 잔액"
                value={balance.data === undefined ? "—" : formatWon(balance.data.availableBalance)}
                sub="지갑 →"
                onClick={() => onSelect("wallet")}
            />
        </div>
    );
}

interface SummaryCellProps {
    label: string;
    value: string;
    sub: ReactNode;
    alert?: boolean;
    onClick: () => void;
}

function SummaryCell({ label, value, sub, alert = false, onClick }: SummaryCellProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-xl border px-4 py-3.5 text-left shadow-sm transition-colors ${
                alert
                    ? "border-live bg-live-bg text-live"
                    : "border-line bg-surface hover:border-line-strong"
            }`}
        >
            <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${alert ? "text-live" : "text-faint"}`}>
                {label}
            </p>
            <p className="mt-1 font-mono text-[22px] font-bold tabular-nums">{value}</p>
            <p className={`mt-0.5 text-[11.5px] ${alert ? "text-live/80" : "text-muted"}`}>{sub}</p>
        </button>
    );
}
