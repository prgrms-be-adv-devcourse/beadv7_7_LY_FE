import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchProductList, searchProducts } from "../api/products";
import { VinylCover } from "../components/VinylCover";
import { QueryState } from "../components/QueryState";
import { Pagination } from "../components/Pagination";
import { LikeButton } from "../components/LikeButton";
import { formatWon } from "../components/AuctionCard";

const PAGE_SIZE = 20;

function SkeletonGrid() {
    return (
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-line bg-surface p-3">
                    <div className="aspect-square rounded-md bg-surface2" />
                    <div className="mt-3 h-4 w-3/4 rounded bg-surface2" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-surface2" />
                </div>
            ))}
        </div>
    );
}

// 검색 결과와 둘러보기 목록을 같은 카드로 그린다. 낙찰가·경매 수는 목록 API에만 있어서
// 검색 결과에서는 undefined로 들어오고, 그때는 아래 통계 줄을 통째로 접는다
interface CatalogCard {
    productId: number;
    title: string;
    artistName: string;
    coverImageUrl: string | null;
    releaseYear: number;
    pressType: string;
    country?: string | null;
    lastTradedPrice?: number | null;
    openAuctionCount?: number | null;
}

function ProductCard({ card }: { card: CatalogCard }) {
    const hasStats = card.lastTradedPrice !== undefined || card.openAuctionCount !== undefined;
    const openCount = card.openAuctionCount ?? 0;

    return (
        <Link
            to={`/products/${card.productId}`}
            className="rounded-xl border border-line bg-surface p-3 shadow-sm transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-line-strong"
        >
            <div className="relative">
                <VinylCover title={card.title} artist={card.artistName} imageUrl={card.coverImageUrl} />
                <LikeButton productId={card.productId} />
            </div>
            <div className="mt-2.5 truncate font-display text-sm font-bold">{card.title}</div>
            <div className="truncate text-xs text-muted">{card.artistName}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded bg-surface2 px-1.5 py-0.5 text-[10.5px] font-semibold text-muted">
                    {card.releaseYear}
                </span>
                <span className="rounded bg-surface2 px-1.5 py-0.5 text-[10.5px] font-semibold text-muted">
                    {card.pressType === "ORIGINAL" ? "오리지널" : "재발매"}
                </span>
                {card.country && (
                    <span className="rounded bg-surface2 px-1.5 py-0.5 text-[10.5px] font-semibold text-muted">
                        {card.country}
                    </span>
                )}
            </div>
            {hasStats && (
                <div className="mt-2.5 flex items-end justify-between border-t border-line pt-2.5">
                    <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">최근 낙찰가</div>
                        {card.lastTradedPrice !== null && card.lastTradedPrice !== undefined ? (
                            <div className="font-mono text-sm font-bold tabular-nums text-up">
                                {formatWon(card.lastTradedPrice)}
                            </div>
                        ) : (
                            <div className="text-[13px] font-semibold text-faint">거래 없음</div>
                        )}
                    </div>
                    <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            openCount > 0 ? "bg-live-bg text-live" : "bg-surface2 text-faint"
                        }`}
                    >
                        {openCount > 0 ? `${openCount}건 경매중` : "경매 없음"}
                    </span>
                </div>
            )}
        </Link>
    );
}

function BrowseList({ page, onPage }: { page: number; onPage: (page: number) => void }) {
    const query = useQuery({
        queryKey: ["productList", page],
        queryFn: () => fetchProductList(page, PAGE_SIZE),
        placeholderData: keepPreviousData,
    });
    return (
        <QueryState
            isLoading={query.isPending}
            error={query.error}
            isEmpty={!query.data || query.data.content.length === 0}
            emptyMessage="등록된 릴리스가 아직 없습니다."
            loadingFallback={<SkeletonGrid />}
        >
            <p className="mb-3 text-[13px] text-muted">
                등록된 릴리스 <b className="font-mono tabular-nums">{query.data?.totalElements}</b>건
            </p>
            <div className={`grid grid-cols-2 gap-3.5 md:grid-cols-4 ${query.isFetching ? "opacity-60" : ""}`}>
                {query.data?.content.map((card) => (
                    <ProductCard key={card.productId} card={card} />
                ))}
            </div>
            {query.data && (
                <Pagination
                    page={page}
                    hasNext={query.data.hasNext}
                    totalElements={query.data.totalElements}
                    size={PAGE_SIZE}
                    onPage={onPage}
                />
            )}
        </QueryState>
    );
}

export function CatalogPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const urlQuery = searchParams.get("q") ?? "";
    const page = Math.max(0, Number(searchParams.get("page") ?? "0") || 0);

    const [input, setInput] = useState(urlQuery);
    const [tooShort, setTooShort] = useState(false);

    // URL → 입력창: 뒤로가기 등 바깥에서 URL이 바뀌면 입력창을 URL에 맞춘다
    useEffect(() => {
        setInput(urlQuery);
    }, [urlQuery]);

    // 검색은 엔터/버튼에서만 실행한다 — 검색 쿼리 1회가 서버에서 수 초짜리라,
    // 타이핑 중간값(디바운스)마다 쏘면 요청이 서버에서 겹쳐 돌며 전체가 느려진다
    function submitSearch(e: React.FormEvent) {
        e.preventDefault();
        const next = input.trim();
        // 1글자 검색은 사실상 전체 훑기라 막는다 (빈 값은 둘러보기 모드로 전환이니 허용)
        if (next.length === 1) {
            setTooShort(true);
            return;
        }
        setTooShort(false);
        setSearchParams(next ? { q: next, page: "0" } : {}, { replace: true });
    }

    const query = useQuery({
        queryKey: ["productSearch", urlQuery, page],
        // React Query가 주는 AbortSignal을 fetch까지 관통시킨다 —
        // 새 검색을 하면 이전 검색 요청이 취소되고, 연결이 끊기면 서버 쿼리도 중단된다
        queryFn: ({ signal }) => searchProducts(urlQuery, page, PAGE_SIZE, signal),
        enabled: urlQuery.trim().length >= 2,
        placeholderData: keepPreviousData,
        // 실패한 검색을 재시도하면 힘든 서버를 더 힘들게 만든다
        retry: 0,
    });

    return (
        <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-brand">카탈로그</p>
            <h2 className="text-lg font-bold tracking-tight">릴리스 검색</h2>
            <p className="mb-4 mt-1 text-[13.5px] text-muted">
                앨범(릴리스) 단위로 탐색합니다 — 검색어가 없으면 등록된 릴리스를 둘러봅니다.
            </p>
            <form onSubmit={submitSearch} className="mb-5 max-w-[520px]">
                <div className="flex overflow-hidden rounded-xl border-[1.5px] border-line-strong bg-surface focus-within:border-brand">
                    <span aria-hidden="true" className="flex items-center pl-4 text-faint">⌕</span>
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="제목·아티스트·카탈로그 번호 (2글자 이상)"
                        aria-label="카탈로그 검색"
                        className="flex-1 bg-transparent px-3 py-3 text-[15px] outline-none placeholder:text-faint"
                    />
                    <button
                        type="submit"
                        disabled={query.isFetching}
                        className="shrink-0 bg-brand px-5 text-[14px] font-semibold text-white disabled:opacity-50"
                    >
                        {query.isFetching ? "검색 중…" : "검색"}
                    </button>
                </div>
                {tooShort && (
                    <p className="mt-1.5 text-[12px] font-semibold text-live">검색어를 2글자 이상 입력해주세요.</p>
                )}
            </form>

            {urlQuery.trim() === "" ? (
                <BrowseList page={page} onPage={(next) => setSearchParams({ page: String(next) })} />
            ) : (
                <QueryState
                    isLoading={query.isPending}
                    error={query.error}
                    isEmpty={!query.data || query.data.content.length === 0}
                    emptyMessage={<>‘{urlQuery}’ 검색 결과가 없습니다. 다른 검색어를 시도해보세요.</>}
                    loadingFallback={<SkeletonGrid />}
                >
                    <p className="mb-3 text-[13px] text-muted">
                        총 <b className="font-mono tabular-nums">{query.data?.totalElements}</b>건
                    </p>
                    <div className={`grid grid-cols-2 gap-3.5 md:grid-cols-4 ${query.isFetching ? "opacity-60" : ""}`}>
                        {query.data?.content.map((card) => (
                            <ProductCard key={card.productId} card={card} />
                        ))}
                    </div>
                    {query.data && (
                        <Pagination
                            page={page}
                            hasNext={query.data.hasNext}
                            totalElements={query.data.totalElements}
                            size={PAGE_SIZE}
                            onPage={(next) => setSearchParams({ q: urlQuery, page: String(next) })}
                        />
                    )}
                </QueryState>
            )}
        </div>
    );
}
