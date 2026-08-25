import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAuctions, parseServerTime, type AuctionListItem } from "../api/auctions";
import { AuctionCard, formatWon } from "../components/AuctionCard";
import { Countdown } from "../components/Countdown";
import { QueryState } from "../components/QueryState";
import { VinylCover } from "../components/VinylCover";

export function HomePage() {
    const ending = useQuery({
        queryKey: ["auctions", "home-ending"],
        queryFn: () => fetchAuctions({ status: "RUNNING", sort: "ending_soon", page: 0, size: 8 }),
    });
    // 시안의 "실시간 경매" — 진행 중인 것만 입찰 많은순으로. 첫 건은 히어로 피처로 승격된다
    const live = useQuery({
        queryKey: ["auctions", "home-live"],
        queryFn: () => fetchAuctions({ status: "RUNNING", sort: "most_bids", page: 0, size: 12 }),
    });

    // 히어로 = 지금 가장 뜨거운 경매 1건 (입찰 많은순 첫 건). 상품이 보이면서
    // 현재가·카운트다운으로 "거래 중"임이 즉시 드러나야 한다
    const featured = live.data?.items[0];
    const liveRest = live.data ? live.data.items.slice(1) : [];
    const runningCount = ending.data?.totalElements;

    return (
        <div>
            {featured ? (
                <FeaturedHero auction={featured} />
            ) : (
                <section className="rounded-2xl border border-line bg-surface p-7 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-live">
                        Rare Pressings, Fair Prices
                    </p>
                    <h1 className="mt-1.5 font-display text-3xl font-semibold leading-tight tracking-tight text-balance">
                        희귀 LP, <em className="italic text-brand">경매</em>로 만나고 시세로 확인하세요
                    </h1>
                    <p className="mt-2 max-w-[46ch] text-sm text-muted">
                        {live.isPending
                            ? "진행 중인 경매를 불러오는 중입니다…"
                            : "지금은 진행 중인 경매가 없습니다. 카탈로그에서 앨범을 둘러보세요."}
                    </p>
                    <Link
                        to="/catalog"
                        className="mt-5 inline-block rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-ink"
                    >
                        카탈로그 둘러보기
                    </Link>
                </section>
            )}
            {runningCount !== undefined && runningCount > 0 && (
                <p className="mt-3.5 text-center text-[13px] text-muted">
                    지금 <b className="font-mono font-bold tabular-nums text-ink">{runningCount}</b>건의 경매가
                    진행 중입니다
                </p>
            )}

            <section className="mt-9">
                <div className="mb-3.5 flex items-baseline justify-between">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-live">지금 마감 임박</p>
                        <h2 className="text-lg font-bold tracking-tight">곧 종료되는 경매</h2>
                    </div>
                    <Link to="/feed" className="text-[13px] font-semibold text-muted hover:text-ink">
                        경매 피드 전체 →
                    </Link>
                </div>
                <QueryState
                    isLoading={ending.isPending}
                    error={ending.error}
                    onRetry={() => ending.refetch()}
                    isEmpty={!ending.data || ending.data.items.length === 0}
                    emptyMessage="진행 중인 경매가 없습니다."
                >
                    <div className="flex snap-x gap-3.5 overflow-x-auto pb-2">
                        {ending.data?.items.map((auction) => (
                            <AuctionCard key={auction.auctionId} auction={auction} className="w-[220px] flex-none snap-start" />
                        ))}
                    </div>
                </QueryState>
            </section>

            <section className="mt-9">
                <div className="mb-3.5 flex items-baseline justify-between">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-brand">진행 중</p>
                        <h2 className="text-lg font-bold tracking-tight">실시간 경매</h2>
                    </div>
                    <Link to="/feed" className="text-[13px] font-semibold text-muted hover:text-ink">
                        더 보기 →
                    </Link>
                </div>
                <QueryState
                    isLoading={live.isPending}
                    error={live.error}
                    onRetry={() => live.refetch()}
                    isEmpty={liveRest.length === 0}
                    emptyMessage="진행 중인 경매가 없습니다."
                >
                    <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
                        {liveRest.map((auction) => (
                            <AuctionCard key={auction.auctionId} auction={auction} />
                        ))}
                    </div>
                </QueryState>
            </section>
        </div>
    );
}

function FeaturedHero({ auction }: { auction: AuctionListItem }) {
    return (
        <section
            className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
            style={{
                background:
                    "radial-gradient(90% 130% at 85% 15%, rgba(138,75,34,.14), transparent 55%) var(--color-surface)",
            }}
        >
            <div className="grid items-center gap-7 p-7 sm:grid-cols-[280px_1fr]">
                <VinylCover
                    title={auction.title}
                    artist={auction.artistName}
                    imageUrl={auction.thumbnail}
                    spin
                    className="rounded-xl shadow-lg"
                />
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-live">이 주의 경매</p>
                    <h1 className="mt-1.5 font-display text-3xl font-bold leading-tight tracking-tight text-balance">
                        {auction.artistName} — {auction.title}
                    </h1>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {auction.pressType && (
                            <span className="rounded bg-surface2 px-2 py-0.5 text-[11.5px] font-bold text-muted">
                                {auction.pressType === "ORIGINAL" ? "오리지널" : "재발매"}
                            </span>
                        )}
                        {auction.releaseYear && (
                            <span className="rounded bg-surface2 px-2 py-0.5 text-[11.5px] font-bold text-muted">
                                {auction.releaseYear}
                            </span>
                        )}
                        <span className="rounded bg-surface2 px-2 py-0.5 text-[11.5px] font-bold text-muted">
                            입찰 {auction.bidCount}회
                        </span>
                    </div>
                    <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-faint">
                                {auction.bidCount > 0 ? "현재가" : "시작가"}
                            </p>
                            <p className="font-mono text-3xl font-bold tabular-nums tracking-tight">
                                {formatWon(auction.finalPrice)}
                            </p>
                        </div>
                        <div className="pb-1">
                            <Countdown endsAt={parseServerTime(auction.endAt)} />
                        </div>
                    </div>
                    <Link
                        to={`/auctions/${auction.auctionId}`}
                        className="mt-5 inline-block rounded-xl bg-live px-7 py-3.5 text-[15px] font-extrabold text-white transition-colors hover:bg-live/90"
                    >
                        입찰하러 가기
                    </Link>
                </div>
            </div>
        </section>
    );
}
