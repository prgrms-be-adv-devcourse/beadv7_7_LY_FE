import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchHostedAuctions, fetchParticipatedAuctions } from "../../api/auctions";
import { fetchOrders, formatOrderStatus, type OrderStatus } from "../../api/orders";
import { fetchPointTransactions, formatTransactionType, getWalletBalance } from "../../api/wallet";
import { formatWon } from "../../components/AuctionCard";
import { formatDateTime } from "./format";
import type { TabValue } from "../MyPage";

// 입찰 중·판매 중 집계는 첫 페이지 표본으로 계산한다 — 진행 중 경매가 이보다 많은
// 계정은 드물고, 전수 집계 API가 생기면 그때 교체
const SUMMARY_SAMPLE = 50;

// 구매자 주문 파이프라인 — 실제 주문 상태 축 그대로 (배송 단계는 서버에 없다)
const PIPELINE: OrderStatus[] = ["PENDING", "ORDERED", "COMPLETED"];

interface OverviewTabProps {
    onSelect: (tab: TabValue) => void;
}

export function OverviewTab({ onSelect }: OverviewTabProps) {
    const balance = useQuery({ queryKey: ["wallet", "balance"], queryFn: getWalletBalance });
    const participated = useQuery({
        queryKey: ["auctions", "participated", "summary"],
        queryFn: () => fetchParticipatedAuctions(0, SUMMARY_SAMPLE),
    });
    const hosted = useQuery({
        queryKey: ["auctions", "hosted", "summary"],
        queryFn: () => fetchHostedAuctions(0, SUMMARY_SAMPLE),
    });
    // 파이프라인 칸별 건수 — size=1로 totalElements만 읽는다
    const pipeline = useQuery({
        queryKey: ["orders", "BUYER", "pipeline"],
        queryFn: async () => {
            const pages = await Promise.all(
                PIPELINE.map((status) => fetchOrders({ perspective: "BUYER", status, page: 0, size: 1 })),
            );
            return Object.fromEntries(PIPELINE.map((status, i) => [status, pages[i].totalElements]));
        },
    });
    const transactions = useQuery({
        queryKey: ["wallet", "transactions", "overview"],
        queryFn: () => fetchPointTransactions({ page: 0, size: 3 }),
    });

    const bidding = participated.data?.items.filter((a) => a.status === "RUNNING") ?? [];
    const topCount = bidding.filter((a) => a.myOutcome === "ACTIVE").length;
    const selling = hosted.data?.items.filter((a) => a.status === "RUNNING") ?? [];
    const sellingBids = selling.reduce((acc, a) => acc + a.bidCount, 0);
    const pendingCount = pipeline.data?.PENDING;
    const recentTxs = transactions.data?.content ?? [];

    const tileClass =
        "rounded-2xl border border-line bg-surface px-4.5 p-4 text-left transition-colors hover:border-line-strong";

    return (
        <div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-2xl border border-line bg-surface p-4">
                    <p className="text-[11.5px] font-bold text-muted">지갑 잔액</p>
                    <p className="mt-1 font-mono text-[22px] font-extrabold tabular-nums">
                        {balance.data ? formatWon(balance.data.availableBalance) : "—"}
                    </p>
                    <div className="mt-2.5 flex gap-1.5">
                        <button
                            type="button"
                            onClick={() => onSelect("wallet")}
                            className="rounded-lg bg-brand px-3 py-1.5 text-[11.5px] font-extrabold text-white hover:bg-brand-ink"
                        >
                            충전
                        </button>
                        <button
                            type="button"
                            onClick={() => onSelect("wallet")}
                            className="rounded-lg border border-line-strong px-3 py-1.5 text-[11.5px] font-extrabold text-muted hover:text-ink"
                        >
                            출금
                        </button>
                    </div>
                </div>
                <button type="button" onClick={() => onSelect("participated")} className={tileClass}>
                    <p className="text-[11.5px] font-bold text-muted">입찰 중</p>
                    <p className="mt-1 font-mono text-[22px] font-extrabold tabular-nums">
                        {participated.data ? bidding.length : "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-faint">
                        {participated.data ? `${topCount}건 내가 최고가` : "불러오는 중…"}
                    </p>
                </button>
                <button type="button" onClick={() => onSelect("hosted")} className={tileClass}>
                    <p className="text-[11.5px] font-bold text-muted">판매 중</p>
                    <p className="mt-1 font-mono text-[22px] font-extrabold tabular-nums">
                        {hosted.data ? selling.length : "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-faint">
                        {hosted.data ? `받은 입찰 ${sellingBids}회` : "불러오는 중…"}
                    </p>
                </button>
                <button type="button" onClick={() => onSelect("orders")} className={tileClass}>
                    <p className="text-[11.5px] font-bold text-muted">결제 대기</p>
                    <p
                        className={`mt-1 font-mono text-[22px] font-extrabold tabular-nums ${
                            (pendingCount ?? 0) > 0 ? "text-live" : ""
                        }`}
                    >
                        {pendingCount ?? "—"}
                    </p>
                    {/* 아직 모르는 상태(로딩·실패)를 "없다"로 단정하지 않는다 — 결제 대기를 놓치면 낙찰이 날아간다 */}
                    <p className="mt-0.5 text-[11px] font-semibold text-faint">
                        {pipeline.isError
                            ? "확인하지 못했습니다 — 주문에서 확인"
                            : pendingCount === undefined
                              ? "불러오는 중…"
                              : pendingCount > 0
                                ? "배송지 입력·결제가 필요합니다"
                                : "처리할 주문이 없습니다"}
                    </p>
                </button>
            </div>

            <div className="mt-3.5 rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-baseline justify-between">
                    <h3 className="text-[14px] font-extrabold">구매 주문</h3>
                    <button type="button" onClick={() => onSelect("orders")} className="text-[12px] font-bold text-muted hover:text-ink">
                        주문 전체 보기 →
                    </button>
                </div>
                <div className="mt-2.5 grid grid-cols-3">
                    {PIPELINE.map((status, index) => {
                        const count = pipeline.data?.[status];
                        return (
                            <button
                                key={status}
                                type="button"
                                onClick={() => onSelect("orders")}
                                className={`relative rounded-lg py-2 text-center hover:bg-surface2 ${
                                    index > 0
                                        ? "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:text-[15px] before:text-line-strong before:content-['›']"
                                        : ""
                                }`}
                            >
                                <p
                                    className={`font-mono text-[20px] font-extrabold tabular-nums ${
                                        count === 0 ? "text-faint" : status === "PENDING" && (count ?? 0) > 0 ? "text-live" : ""
                                    }`}
                                >
                                    {count ?? "—"}
                                </p>
                                <p className="mt-0.5 text-[11.5px] font-bold text-muted">{formatOrderStatus(status)}</p>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="mt-3.5 grid items-start gap-3.5 lg:grid-cols-[1.35fr_1fr]">
                <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                    <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
                        <h3 className="text-[14px] font-extrabold">참여 중인 경매</h3>
                        <button
                            type="button"
                            onClick={() => onSelect("participated")}
                            className="text-[12px] font-bold text-muted hover:text-ink"
                        >
                            전체 보기 →
                        </button>
                    </div>
                    {bidding.length === 0 ? (
                        <p className="px-4 py-8 text-center text-[13px] text-muted">
                            입찰 중인 경매가 없습니다.{" "}
                            <Link to="/feed" className="font-bold text-brand hover:underline">
                                경매 둘러보기 →
                            </Link>
                        </p>
                    ) : (
                        bidding.slice(0, 3).map((auction) => (
                            <Link
                                key={auction.auctionId}
                                to={`/auctions/${auction.auctionId}`}
                                className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 hover:bg-paper"
                            >
                                <div
                                    className="h-10 w-10 flex-none rounded-lg bg-surface2 bg-cover bg-center"
                                    style={auction.thumbnail ? { backgroundImage: `url(${auction.thumbnail})` } : undefined}
                                />
                                <div className="min-w-0">
                                    <p className="truncate text-[13px] font-bold">{auction.title}</p>
                                    <p className="truncate text-[11.5px] text-faint">{auction.artistName}</p>
                                </div>
                                <div className="ml-auto flex-none text-right">
                                    <span
                                        className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
                                            auction.myOutcome === "ACTIVE" ? "bg-up-bg text-up" : "bg-live-bg text-live"
                                        }`}
                                    >
                                        {auction.myOutcome === "ACTIVE" ? "내가 최고가" : "더 높은 입찰 있음"}
                                    </span>
                                    <p className="mt-0.5 font-mono text-[13px] font-bold tabular-nums">
                                        {formatWon(auction.highestBidAmount ?? auction.myBidAmount)}
                                        <span className="ml-1 font-sans text-[10.5px] font-semibold text-faint">
                                            내 입찰 {formatWon(auction.myBidAmount)}
                                        </span>
                                    </p>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
                <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                    <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
                        <h3 className="text-[14px] font-extrabold">최근 지갑 내역</h3>
                        <button
                            type="button"
                            onClick={() => onSelect("wallet")}
                            className="text-[12px] font-bold text-muted hover:text-ink"
                        >
                            지갑으로 →
                        </button>
                    </div>
                    {recentTxs.length === 0 ? (
                        <p className="px-4 py-8 text-center text-[13px] text-muted">지갑 내역이 없습니다.</p>
                    ) : (
                        recentTxs.map((tx) => (
                            <div key={tx.transactionId} className="flex items-center gap-2.5 border-b border-line px-4 py-2.5 last:border-b-0">
                                <span className="rounded-md bg-surface2 px-2 py-0.5 text-[11px] font-extrabold text-muted">
                                    {formatTransactionType(tx.type)}
                                </span>
                                <span className="text-[11.5px] text-faint">{formatDateTime(tx.createdAt)}</span>
                                <b
                                    className={`ml-auto font-mono text-[13px] font-bold tabular-nums ${
                                        tx.amount > 0 ? "text-up" : "text-ink"
                                    }`}
                                >
                                    {tx.amount > 0 ? "+" : "-"}
                                    {formatWon(Math.abs(tx.amount))}
                                </b>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
