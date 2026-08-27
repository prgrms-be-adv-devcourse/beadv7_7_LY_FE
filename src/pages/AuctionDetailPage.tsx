import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCondition, getAuctionDetail, parseServerTime, placeBid, type AuctionDetail } from "../api/auctions";
import { ApiError } from "../api/client";
import { getMyProfile } from "../api/members";
import { useNow } from "../components/Countdown";
import { useSession } from "../auth/session";
import { VinylCover } from "../components/VinylCover";
import { QueryState } from "../components/QueryState";
import { WatchButton } from "../components/WatchButton";
import { formatWon } from "../components/AuctionCard";
import { showToast } from "../components/Toasts";
import { VuCountdown } from "./auction-detail/VuCountdown";
import { BidLog } from "./auction-detail/BidLog";
import { PriceSummaryBlock } from "./auction-detail/PriceSummaryBlock";

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
        <aside className="rounded-2xl border-[1.5px] border-line-strong bg-surface p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                현재가 · <span className="font-mono tabular-nums">{auction.bidCount ?? 0}</span>건 입찰
            </p>
            <p className="mt-1 font-mono text-3xl font-bold tabular-nums tracking-tight">{formatWon(currentPrice)}</p>
            <p className="mt-1.5 text-xs text-muted">
                시작가 {formatWon(auction.startBidAmount)} · 입찰 단위 {formatWon(auction.bidUnit)}
            </p>
            {auction.myHighest && <p className="mt-1.5 text-xs font-bold text-up">내가 최고 입찰자입니다</p>}
            <PriceSummaryBlock
                productId={auction.product.productId}
                itemCondition={auction.itemCondition}
                currentPrice={currentPrice}
            />
            <VuCountdown startedAt={parseServerTime(auction.startAt)} endsAt={parseServerTime(auction.endAt)} />
            {session ? (
                <div className="mt-4">
                    <label className="block">
                        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-faint">
                            입찰 금액
                        </span>
                        <input
                            type="number"
                            inputMode="numeric"
                            min={nextBid}
                            step={auction.bidUnit}
                            value={amountInput ?? String(nextBid)}
                            disabled={ended}
                            onChange={(e) => setAmountInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") submitBid();
                            }}
                            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-right font-mono text-[15px] font-bold tabular-nums outline-none focus:border-line-strong"
                        />
                    </label>
                    <p className="mt-1 text-[11.5px] text-faint">
                        최소 {formatWon(nextBid)} · {formatWon(auction.bidUnit)} 단위로 올릴 수 있습니다
                    </p>
                    <button
                        type="button"
                        onClick={submitBid}
                        disabled={bidMutation.isPending || ended}
                        className="mt-2.5 w-full rounded-xl bg-live py-3.5 text-[15px] font-extrabold text-white transition-colors hover:bg-live/90 disabled:opacity-60"
                    >
                        {ended
                            ? "경매가 마감되었습니다"
                            : bidMutation.isPending
                              ? "입찰 중…"
                              : Number.isFinite(bidAmount) && bidAmount > 0
                                ? `${formatWon(bidAmount)} 입찰하기`
                                : "입찰하기"}
                    </button>
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
        <aside className="rounded-2xl border-[1.5px] border-line-strong bg-surface p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">경매 결과</p>
            <p className="mt-1 text-xl font-bold">{STATUS_LABELS[auction.status] ?? auction.status}</p>
            {auction.status === "SCHEDULED" && (
                <p className="mt-2 text-sm text-muted">
                    {new Date(parseServerTime(auction.startAt)).toLocaleString("ko-KR")} 시작 예정 · 시작가{" "}
                    {formatWon(auction.startBidAmount)}
                </p>
            )}
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
        </aside>
    );
}

// 판매자가 올린 이 판의 사진과 설명. 위쪽 커버는 음반 자체의 대표 이미지라
// "내가 파는 판이 어떤 상태인가"는 알려주지 않는다 — 사는 사람이 실제로 보고 판단하는 곳이다
function ItemNotes({ description, images }: { description: string | null; images: string[] | null }) {
    const photos = images ?? [];
    const [zoomed, setZoomed] = useState<string | null>(null);

    return (
        <section className="mt-7 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h3 className="text-[15px] font-bold">판매자가 올린 매물 정보</h3>
                {photos.length > 0 && (
                    <span className="text-xs text-muted">
                        사진 <span className="font-mono tabular-nums">{photos.length}</span>장
                    </span>
                )}
            </div>
            <div className="px-5 py-4">
                {photos.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2.5">
                        {photos.map((photo, index) => (
                            <button
                                key={`${index}-${photo.slice(0, 32)}`}
                                type="button"
                                onClick={() => setZoomed(photo)}
                                className="overflow-hidden rounded-lg border border-line transition-colors hover:border-line-strong"
                            >
                                <img
                                    src={photo}
                                    alt={`매물 사진 ${index + 1}`}
                                    loading="lazy"
                                    className="h-32 w-32 object-cover"
                                />
                            </button>
                        ))}
                    </div>
                )}
                {description ? (
                    // 판매자가 넣은 줄바꿈을 그대로 살린다
                    <p className="max-w-[70ch] whitespace-pre-line text-[14px] leading-relaxed">{description}</p>
                ) : (
                    <p className="text-[13.5px] text-muted">판매자가 남긴 설명이 없습니다.</p>
                )}
                {photos.length === 0 && (
                    <p className="mt-2 text-[13.5px] text-muted">올라온 매물 사진이 없습니다.</p>
                )}
            </div>

            {zoomed && (
                <div
                    role="presentation"
                    onClick={() => setZoomed(null)}
                    className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6"
                >
                    <img src={zoomed} alt="매물 사진 크게 보기" className="max-h-full max-w-full rounded-lg" />
                </div>
            )}
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
        // 진행 중 경매만 주기적으로 다시 읽어 현재가·다음 입찰가를 최신으로 유지한다
        refetchInterval: (query) => (query.state.data?.status === "RUNNING" ? 5_000 : false),
    });

    const auction = auctionQuery.data;

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
                            <div className="grid items-start gap-6 sm:grid-cols-[220px_1fr]">
                                <div>
                                    <VinylCover
                                        title={auction.product.title}
                                        artist={auction.product.artistName}
                                        imageUrl={auction.product.coverImageUrl}
                                        spin={auction.status === "RUNNING"}
                                        className="rounded-xl shadow"
                                    />
                                    <div className="mt-3">
                                        <WatchButton
                                            auctionId={auction.auctionId}
                                            status={auction.status}
                                            variant="inline"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-balance">
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
                                            ["판매자", auction.seller.nickname],
                                            ["상태", STATUS_LABELS[auction.status] ?? auction.status],
                                        ].map(([label, value]) => (
                                            <div key={label}>
                                                <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                                                    {label}
                                                </dt>
                                                <dd className="m-0 mt-0.5 text-[14px] font-bold">{value || "—"}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>
                            </div>

                            <ItemNotes description={auction.itemDescription} images={auction.itemImages} />

                            <section className="mt-7 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
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
                        </div>

                        {auction.status === "RUNNING" ? <BidBox auction={auction} /> : <EndedBox auction={auction} />}
                    </div>
                </div>
            )}
        </QueryState>
    );
}
