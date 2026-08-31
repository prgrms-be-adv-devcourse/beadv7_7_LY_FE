import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    fetchAuctions,
    formatCondition,
    getAuctionDetail,
    parseServerTime,
    placeBid,
    type AuctionDetail,
} from "../api/auctions";
import { ApiError } from "../api/client";
import { getMyProfile } from "../api/members";
import { getPriceTrades } from "../api/products";
import { Countdown, useNow } from "../components/Countdown";
import { useSession } from "../auth/session";
import { VinylCover } from "../components/VinylCover";
import { QueryState } from "../components/QueryState";
import { WatchButton } from "../components/WatchButton";
import { AuctionCard, formatWon } from "../components/AuctionCard";
import { showToast } from "../components/Toasts";
import { formatAgo } from "../lib/format";
import { VuCountdown } from "./auction-detail/VuCountdown";
import { BidLog } from "./auction-detail/BidLog";
import { PriceSummaryBlock } from "./auction-detail/PriceSummaryBlock";
import { PriceSparkline } from "./product-detail/PriceSparkline";

const STATUS_LABELS: Record<string, string> = {
    SCHEDULED: "시작 전",
    RUNNING: "진행 중",
    CLOSING: "낙찰 처리 중",
    ENDED_WON: "낙찰 완료",
    ENDED_FAILED: "유찰",
    CANCELED: "취소됨",
    FORCE_CANCELED: "관리자 취소",
};

function BidBox({ auction }: { auction: AuctionDetail }) {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const [bidError, setBidError] = useState<string | null>(null);
    const [snapNote, setSnapNote] = useState<string | null>(null);
    const session = useSession();

    const currentPrice = auction.highestBidAmount ?? auction.startBidAmount;
    const nextBid = auction.nextMinBidAmount ?? auction.startBidAmount;

    // 입력 전(null)에는 항상 최신 최소 입찰가를 따라간다 — 주기 갱신으로 최소가가 올라도
    // 낡은 금액이 입력칸에 남지 않는다. 사용자가 한 번 고치면 그 값을 유지한다
    const [amountInput, setAmountInput] = useState<string | null>(null);
    const bidAmount = amountInput === null ? nextBid : Number(amountInput);

    // 마감 시각이 지나면 서버가 상태를 옮기기 전(폴링 5초 + 스케줄러 지연)에도 입력·버튼을 잠근다 —
    // 어차피 서버가 거절할 입찰을 눌리게 두면 마지막 순간의 사용자가 실패 메시지만 받는다
    const now = useNow();
    const ended = now >= parseServerTime(auction.endAt);

    const bidMutation = useMutation({
        mutationFn: (amount: number) => placeBid(auction.auctionId, amount),
        onSuccess: (_, amount) => {
            setBidError(null);
            // 입찰 후에는 새 최소 입찰가부터 다시 시작한다
            setAmountInput(null);
            setSnapNote(null);
            queryClient.invalidateQueries({ queryKey: ["auction", String(auction.auctionId)] });
            // 실패만 알리고 성공은 조용하던 비대칭을 메운다 — 핵심 액션엔 성공 확인이 필요
            showToast(`${formatWon(amount)} 입찰 완료 — 현재 최고 입찰자입니다`);
        },
        onError: (error) => {
            setBidError(error instanceof ApiError ? error.message : "입찰 처리 중 문제가 생겼습니다.");
            // 실패 원인이 대부분 "남이 먼저 입찰해서 최소 입찰가가 올라감"이라, 낡은 금액으로
            // 같은 실패를 반복하지 않게 바로 다시 읽어온다
            queryClient.invalidateQueries({ queryKey: ["auction", String(auction.auctionId)] });
        },
    });

    // 버튼으로 금액을 올리고 내린다. 단위에 안 맞는 값을 직접 입력한 뒤 눌러도
    // 단위에 맞는 값으로 떨어지게 맞춰준다 (올릴 땐 위쪽, 내릴 땐 아래쪽 값으로)
    function stepBid(direction: 1 | -1) {
        if (ended) return;
        setSnapNote(null);
        // 비었거나 최소 미만이면 어느 방향이든 최소 입찰가로 되돌린다
        if (!Number.isFinite(bidAmount) || bidAmount < nextBid) {
            setAmountInput(String(nextBid));
            return;
        }
        const steps = (bidAmount - nextBid) / auction.bidUnit;
        const nextSteps = direction > 0 ? Math.floor(steps) + 1 : Math.ceil(steps) - 1;
        setAmountInput(String(nextBid + Math.max(0, nextSteps) * auction.bidUnit));
    }

    // 직접 입력한 값이 입찰 단위에 맞지 않으면 아래 방향으로 자동 보정한다 (팀 확정 동작).
    // 제출 시 검증은 남겨둔다 — 보정 직후 최소가가 올라간 경우의 이중 안전장치
    function snapOnBlur() {
        if (amountInput === null || ended) return;
        const entered = Number(amountInput);
        if (!Number.isFinite(entered) || amountInput.trim() === "") {
            setAmountInput(null);
            setSnapNote(null);
            return;
        }
        if (entered <= nextBid) {
            setAmountInput(null);
            setSnapNote(entered < nextBid ? `최소 입찰가는 ${formatWon(nextBid)}입니다.` : null);
            return;
        }
        const fitted = nextBid + Math.floor((entered - nextBid) / auction.bidUnit) * auction.bidUnit;
        if (fitted !== entered) {
            setAmountInput(String(fitted));
            setSnapNote(`입찰 단위 ${formatWon(auction.bidUnit)}에 맞춰 ${formatWon(fitted)}(으)로 조정했습니다.`);
        } else {
            setSnapNote(null);
        }
    }

    function submitBid() {
        if (bidMutation.isPending || ended) return;
        if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
            showToast("입찰 금액을 숫자로 입력해주세요.");
            return;
        }
        if (bidAmount < nextBid) {
            showToast(`최소 입찰 금액은 ${formatWon(nextBid)}입니다.`);
            return;
        }
        if ((bidAmount - nextBid) % auction.bidUnit !== 0) {
            showToast(`${formatWon(nextBid)}부터 ${formatWon(auction.bidUnit)} 단위로만 입찰할 수 있습니다.`);
            return;
        }
        bidMutation.mutate(bidAmount);
    }

    return (
        <aside className="rounded-2xl border border-line bg-surface p-5 shadow-[0_6px_24px_rgba(35,36,31,0.07)]">
            <p className="text-[12px] font-bold text-muted">현재가</p>
            <p className="mt-0.5 font-mono text-[32px] font-extrabold leading-tight tabular-nums tracking-tight">
                {formatWon(currentPrice)}
            </p>
            {auction.myHighest && <p className="mt-1 text-xs font-bold text-up">내가 최고 입찰자입니다</p>}
            <VuCountdown startedAt={parseServerTime(auction.startAt)} endsAt={parseServerTime(auction.endAt)} />
            {/* 입찰 판단 재료를 라벨-값 행으로 정돈한다. 기록 보기는 아래 호가 로그로 내려간다 */}
            <div className="mt-4 overflow-hidden rounded-xl border border-line bg-paper text-[12.5px]">
                {[
                    [
                        "입찰 기록",
                        <span key="bids">
                            <b className="font-mono font-bold tabular-nums">{auction.bidCount ?? 0}</b>회{" "}
                            <a href="#bidlog" className="font-semibold text-brand underline">
                                기록 보기
                            </a>
                        </span>,
                    ],
                    ["시작가", <b key="s" className="font-mono font-bold tabular-nums">{formatWon(auction.startPrice)}</b>],
                    ["배송비", <b key="f" className="font-mono font-bold tabular-nums">{formatWon(auction.shippingPrice)}</b>],
                    ["입찰 단위", <b key="u" className="font-mono font-bold tabular-nums">{formatWon(auction.bidUnit)}</b>],
                    ...(auction.extensionEnabled && auction.extensionTime !== null
                        ? [
                              [
                                  "자동 연장",
                                  <span key="e" className="font-semibold">
                                      마감 {auction.extensionTime}분 안 입찰 시 +{auction.extensionTime}분
                                  </span>,
                              ] as const,
                          ]
                        : []),
                ].map(([label, value]) => (
                    <div
                        key={String(label)}
                        className="flex items-baseline justify-between border-b border-line px-3.5 py-2 last:border-b-0"
                    >
                        <span className="font-medium text-muted">{label}</span>
                        {value}
                    </div>
                ))}
            </div>
            {session ? (
                <div className="mt-4">
                    <div className="flex items-stretch gap-1.5">
                        <button
                            type="button"
                            onClick={() => stepBid(-1)}
                            disabled={ended || bidAmount <= nextBid}
                            aria-label={`${formatWon(auction.bidUnit)} 내리기`}
                            className="w-11 shrink-0 rounded-xl border border-line bg-surface text-lg font-bold text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
                        >
                            −
                        </button>
                        <input
                            type="number"
                            inputMode="numeric"
                            min={nextBid}
                            step={auction.bidUnit}
                            value={amountInput ?? String(nextBid)}
                            disabled={ended}
                            aria-label="입찰 금액"
                            onChange={(e) => setAmountInput(e.target.value)}
                            onBlur={snapOnBlur}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    snapOnBlur();
                                    submitBid();
                                }
                            }}
                            className="min-w-0 grow rounded-xl border border-line-strong bg-surface px-3 py-2 text-center font-mono text-[15.5px] font-bold tabular-nums outline-none focus:border-brand"
                        />
                        <button
                            type="button"
                            onClick={() => stepBid(1)}
                            disabled={ended}
                            aria-label={`${formatWon(auction.bidUnit)} 올리기`}
                            className="w-11 shrink-0 rounded-xl border border-line bg-surface text-lg font-bold text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
                        >
                            +
                        </button>
                    </div>
                    {snapNote && <p className="mt-1.5 text-[11.5px] font-bold leading-snug text-live break-keep">{snapNote}</p>}
                    <button
                        type="button"
                        onClick={submitBid}
                        disabled={bidMutation.isPending || ended}
                        className="mt-2.5 w-full rounded-xl bg-brand py-3.5 text-[15px] font-extrabold text-white transition-colors hover:bg-brand-ink disabled:opacity-60"
                    >
                        {ended
                            ? "경매가 마감되었습니다"
                            : bidMutation.isPending
                              ? "입찰 중…"
                              : Number.isFinite(bidAmount) && bidAmount > 0
                                ? `${formatWon(bidAmount)} 입찰하기`
                                : "입찰하기"}
                    </button>
                    <p className="mt-3 text-center text-[11.5px] leading-relaxed text-faint break-keep">
                        입찰 금액에는 배송비가 포함되어 있습니다. 예치금으로 결제되고, 구매를 확정한 뒤에
                        판매자에게 정산됩니다.
                    </p>
                </div>
            ) : (
                <button
                    type="button"
                    // 로그인 후 이 경매로 돌아온다 — 홈에 떨어뜨리면 다시 찾아와야 한다
                    onClick={() => navigate("/login", { state: { from: location.pathname } })}
                    className="mt-4 w-full rounded-xl border-[1.5px] border-line-strong bg-paper py-3.5 text-[15px] font-extrabold transition-colors hover:border-brand hover:text-brand"
                >
                    로그인 후 입찰하기
                </button>
            )}
            {bidError && <p className="mt-2.5 text-center text-[12px] font-semibold text-live">{bidError}</p>}
            <PriceSummaryBlock
                productId={auction.product.productId}
                itemCondition={auction.itemCondition}
                currentPrice={currentPrice}
            />
        </aside>
    );
}

function ScheduledBox({ auction }: { auction: AuctionDetail }) {
    return (
        <aside className="rounded-2xl border border-line bg-surface p-5 shadow-[0_6px_24px_rgba(35,36,31,0.07)]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">경매 예정</p>
            <p className="mt-1 text-xl font-bold">시작 전</p>
            <p className="mt-2 text-sm text-muted">
                시작까지 <Countdown endsAt={parseServerTime(auction.startAt)} expiredLabel="곧 시작" />
            </p>
            <p className="mt-2 text-sm text-muted">
                {new Date(parseServerTime(auction.startAt)).toLocaleString("ko-KR")} 시작 예정 · 시작가{" "}
                {formatWon(auction.startBidAmount)}
            </p>
        </aside>
    );
}

function EndedBox({ auction }: { auction: AuctionDetail }) {
    const session = useSession();
    // 서버가 종료 상태에는 요청자 기준 필드(myHighest 같은)를 안 주므로, 낙찰자 닉네임(회원 유일값,
    // 마스킹 없이 내려옴)과 내 프로필 닉네임을 비교해 낙찰자인지 판별한다
    const profile = useQuery({
        queryKey: ["member", "me"],
        queryFn: getMyProfile,
        enabled: session !== null && auction.status === "ENDED_WON",
    });
    const isWinner = auction.winningBid != null && profile.data?.nickname === auction.winningBid.bidder;

    return (
        <aside className="rounded-2xl border border-line bg-surface p-5 shadow-[0_6px_24px_rgba(35,36,31,0.07)]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">경매 결과</p>
            <p className="mt-1 text-xl font-bold">{STATUS_LABELS[auction.status] ?? auction.status}</p>
            {auction.winningBid && (
                <p className="mt-2 text-sm text-muted">
                    낙찰가 <b className="font-mono tabular-nums text-ink">{formatWon(auction.winningBid.amount)}</b> ·{" "}
                    {auction.winningBid.bidder}
                </p>
            )}
            {isWinner && (
                <div className="mt-3 rounded-xl border border-up/40 bg-up/10 px-3.5 py-3">
                    <p className="text-sm font-bold text-up">내가 낙찰받았습니다</p>
                    <p className="mt-1 text-[13px] text-muted">
                        마이페이지 주문에서 배송지를 입력하고 결제하면 거래가 진행됩니다.
                    </p>
                    <Link
                        to="/mypage?tab=orders"
                        className="mt-2.5 inline-block rounded-lg bg-brand px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-ink"
                    >
                        주문 확인하러 가기 →
                    </Link>
                </div>
            )}
            {auction.status === "ENDED_FAILED" && <p className="mt-2 text-sm text-muted">입찰자가 없어 유찰되었습니다.</p>}
            {auction.status === "CLOSING" && <p className="mt-2 text-sm text-muted">마감 후 낙찰 결과를 계산하고 있습니다.</p>}
            {auction.status === "CANCELED" && (
                <p className="mt-2 text-sm text-muted">판매자가 시작 전에 취소한 경매입니다.</p>
            )}
            {auction.status === "FORCE_CANCELED" && (
                <p className="mt-2 text-sm text-muted">
                    운영자가 중단한 경매입니다. 입찰로 묶여 있던 예치금은 지갑으로 돌아옵니다.
                </p>
            )}
        </aside>
    );
}

// 커버 열 — 판매자가 올린 매물 사진이 있으면 그 사진들이 주인공이다 (피드 카드 썸네일과 같은
// 우선순위). 카탈로그 커버는 상품 상세(제목 링크)가 담당하고, 사진이 없을 때만 폴백으로 쓴다
function CoverColumn({ auction }: { auction: AuctionDetail }) {
    const photos = auction.itemImages ?? [];
    const [selected, setSelected] = useState(0);
    const [zoomed, setZoomed] = useState(false);
    const main = photos[selected] ?? photos[0];

    return (
        <div>
            {photos.length > 0 ? (
                <button
                    type="button"
                    onClick={() => setZoomed(true)}
                    aria-label="매물 사진 크게 보기"
                    className="block w-full overflow-hidden rounded-xl shadow"
                >
                    <img src={main} alt="매물 사진" className="aspect-square w-full object-cover" />
                </button>
            ) : (
                <VinylCover
                    title={auction.product.title}
                    artist={auction.product.artistName}
                    imageUrl={auction.product.coverImageUrl}
                    spin={auction.status === "RUNNING"}
                    className="rounded-xl shadow"
                />
            )}
            {photos.length > 1 && (
                <div className="mt-2.5 grid grid-cols-4 gap-2">
                    {photos.map((photo, index) => (
                        <button
                            key={`${index}-${photo.slice(0, 32)}`}
                            type="button"
                            onClick={() => setSelected(index)}
                            aria-label={`매물 사진 ${index + 1} 보기`}
                            aria-current={index === selected}
                            className={`overflow-hidden rounded-lg border transition-colors ${
                                index === selected ? "border-brand" : "border-line hover:border-line-strong"
                            }`}
                        >
                            <img src={photo} alt={`매물 사진 ${index + 1}`} loading="lazy" className="aspect-square w-full object-cover" />
                        </button>
                    ))}
                </div>
            )}
            <div className="mt-3">
                <WatchButton auctionId={auction.auctionId} status={auction.status} variant="inline" />
            </div>
            {zoomed && main && (
                <div
                    role="presentation"
                    onClick={() => setZoomed(false)}
                    className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6"
                >
                    <img src={main} alt="매물 사진 크게 보기" className="max-h-full max-w-full rounded-lg" />
                </div>
            )}
        </div>
    );
}

// 이 판의 낙찰 시세 — 상품 상세와 같은 원장 데이터. 기록이 없으면 카드를 그리지 않는다
function TradesCard({ productId }: { productId: number }) {
    const trades = useQuery({
        queryKey: ["priceTrades", String(productId)],
        queryFn: () => getPriceTrades(productId),
        staleTime: 60_000,
    });
    const items = trades.data?.trades ?? [];
    if (items.length === 0) return null;

    const recent = [...items].sort((a, b) => b.tradedAt.localeCompare(a.tradedAt)).slice(0, 5);
    return (
        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h3 className="text-[15px] font-bold">이 판의 낙찰 시세</h3>
                <Link to={`/products/${productId}`} className="text-xs font-semibold text-muted hover:text-ink">
                    상품 상세에서 자세히 →
                </Link>
            </div>
            <div className="px-5 pb-2 pt-4">
                <PriceSparkline trades={items} conditions={null} />
            </div>
            <div className="px-5 pb-3">
                {recent.map((trade, i) => (
                    <div
                        key={`${trade.tradedAt}-${i}`}
                        className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-line py-2 last:border-b-0"
                    >
                        <span className="text-[12.5px] font-semibold text-muted">
                            {formatCondition(trade.condition).split(" ")[0]}
                        </span>
                        <span className="font-mono text-sm font-bold tabular-nums">{formatWon(trade.price)}</span>
                        <span className="min-w-[62px] text-right text-[11.5px] text-faint">{formatAgo(trade.tradedAt)}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}

export function AuctionDetailPage() {
    const { auctionId = "" } = useParams();

    const auctionQuery = useQuery({
        queryKey: ["auction", auctionId],
        queryFn: () => getAuctionDetail(auctionId),
        enabled: auctionId !== "",
        // 전역에서 refetchOnWindowFocus를 꺼놔서, 남이 입찰해도 이 화면은 저절로 갱신되지 않는다.
        // 진행 중엔 현재가를, 낙찰 처리 중엔 결과를 기다리는 화면이라 주기적으로 다시 읽는다.
        // 시작 전엔 시작 시각이 지나면 진행 중 화면으로 넘어가도록 느슨하게만 확인한다
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            if (status === "RUNNING" || status === "CLOSING") return 5_000;
            if (status === "SCHEDULED") return 30_000;
            return false;
        },
    });

    const auction = auctionQuery.data;

    // 판매자 블록과 "다른 매물" 레일이 같이 쓰는 조회 — totalElements가 판매 건수다
    const sellerId = auction?.seller.sellerId;
    const sellerAuctions = useQuery({
        queryKey: ["auctions", "seller", sellerId],
        queryFn: () => fetchAuctions({ sellerId: sellerId!, page: 0, size: 7 }),
        enabled: sellerId != null,
        staleTime: 60_000,
    });
    const otherAuctions =
        sellerAuctions.data?.items.filter((item) => String(item.auctionId) !== auctionId).slice(0, 6) ?? [];

    return (
        <QueryState
            isLoading={auctionQuery.isPending}
            error={auctionQuery.error}
            onRetry={() => auctionQuery.refetch()}
            isEmpty={!auction}
            emptyMessage={
                <div>
                    존재하지 않는 경매입니다.
                    <div className="mt-3">
                        <Link to="/feed" className="font-semibold text-brand hover:underline">
                            경매 피드로 돌아가기 →
                        </Link>
                    </div>
                </div>
            }
        >
            {auction && (
                <div>
                    <Link to="/feed" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink">
                        ← 경매 피드로
                    </Link>
                    <div className="grid items-start gap-7 md:grid-cols-[1fr_380px]">
                        <div>
                            <div className="grid items-start gap-6 sm:grid-cols-[240px_1fr]">
                                <CoverColumn auction={auction} />
                                <div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span
                                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-extrabold ${
                                                auction.status === "RUNNING"
                                                    ? "bg-live-bg text-live"
                                                    : "bg-surface2 text-muted"
                                            }`}
                                        >
                                            {auction.status === "RUNNING" && (
                                                <i className="h-[7px] w-[7px] animate-[live-pulse_1.6s_infinite] rounded-full bg-live motion-reduce:animate-none" />
                                            )}
                                            {STATUS_LABELS[auction.status] ?? auction.status}
                                        </span>
                                        {auction.extensionEnabled && auction.extensionTime !== null && (
                                            <span className="rounded-full bg-surface2 px-3 py-1 text-[12px] font-extrabold text-muted">
                                                자동 연장 경매
                                            </span>
                                        )}
                                    </div>
                                    <h1 className="mt-3 font-display text-[30px] font-bold leading-tight tracking-tight text-balance break-keep">
                                        <Link to={`/products/${auction.product.productId}`} className="hover:underline">
                                            {auction.product.title}
                                        </Link>
                                    </h1>
                                    <p className="mt-1 text-base font-bold text-brand">{auction.product.artistName}</p>
                                    <dl className="mt-5 grid w-fit grid-cols-3 gap-x-9 gap-y-3.5 border-t border-line pt-4">
                                        {[
                                            ["컨디션", formatCondition(auction.itemCondition)],
                                            ["프레스", auction.product.pressType === "ORIGINAL" ? "오리지널" : "재발매"],
                                            ["발매", auction.product.releaseYear],
                                        ].map(([label, value]) => (
                                            <div key={label}>
                                                <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                                                    {label}
                                                </dt>
                                                <dd className="m-0 mt-0.5 text-[14px] font-bold">{value || "—"}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                    {/* 판매자 블록 — 닉네임이 없으면(탈퇴 등) "알 수 없음"을 두 번 쓰는 대신 블록을 숨긴다 */}
                                    {auction.seller.nickname && (
                                        <div className="mt-5 flex max-w-[420px] items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                                            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand text-[15px] font-extrabold text-white">
                                                {auction.seller.nickname[0]}
                                            </div>
                                            <div>
                                                <p className="text-[13.5px] font-extrabold">{auction.seller.nickname}</p>
                                                {sellerAuctions.data && (
                                                    <p className="text-[12px] text-muted">
                                                        판매{" "}
                                                        <span className="font-mono font-bold tabular-nums">
                                                            {sellerAuctions.data.totalElements}
                                                        </span>
                                                        건
                                                    </p>
                                                )}
                                            </div>
                                            {otherAuctions.length > 0 && (
                                                <a
                                                    href="#seller-others"
                                                    className="ml-auto flex-none text-[12.5px] font-bold text-brand"
                                                >
                                                    다른 매물 →
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 판매자가 남긴 설명 — 없으면 카드를 그리지 않는다 */}
                            {auction.itemDescription && (
                                <section className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                                    <h3 className="border-b border-line px-5 py-3.5 text-[13px] font-extrabold text-muted">
                                        판매자가 남긴 설명
                                    </h3>
                                    {/* 판매자가 넣은 줄바꿈을 그대로 살린다 */}
                                    <p className="max-w-[72ch] whitespace-pre-line px-5 py-4 text-[14px] leading-[1.85] text-ink">
                                        {auction.itemDescription}
                                    </p>
                                </section>
                            )}

                            <div className="mt-6 grid items-start gap-5 md:grid-cols-2">
                                {/* 시세 카드가 기록 없음으로 빠지면 유일한 자식이 되므로 전폭으로 편다 */}
                                <section
                                    id="bidlog"
                                    className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm md:only:col-span-2"
                                >
                                    <div className="flex items-center justify-between border-b border-line px-5 py-4">
                                        <h3 className="text-[15px] font-bold">호가 로그</h3>
                                        {(auction.recentBids?.length ?? 0) > 0 && (
                                            <span className="text-xs text-muted">
                                                최근 <span className="font-mono tabular-nums">{auction.recentBids?.length}</span>건
                                            </span>
                                        )}
                                    </div>
                                    <BidLog entries={auction.recentBids ?? []} status={auction.status} />
                                </section>
                                <TradesCard productId={auction.product.productId} />
                            </div>

                            {otherAuctions.length > 0 && (
                                <section id="seller-others" className="mt-8 scroll-mt-4">
                                    <h3 className="mb-4 font-display text-xl font-bold tracking-tight">
                                        이 판매자의 다른 매물
                                    </h3>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
                                        {otherAuctions.map((item) => (
                                            <AuctionCard key={item.auctionId} auction={item} />
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>

                        {auction.status === "RUNNING" ? (
                            <BidBox auction={auction} />
                        ) : auction.status === "SCHEDULED" ? (
                            <ScheduledBox auction={auction} />
                        ) : (
                            <EndedBox auction={auction} />
                        )}
                    </div>
                </div>
            )}
        </QueryState>
    );
}
