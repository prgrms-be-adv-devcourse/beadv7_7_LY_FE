import { Link, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchAuctions, type AuctionSort } from "../api/auctions";
import { AuctionCard } from "../components/AuctionCard";
import { QueryState } from "../components/QueryState";
import { Pagination } from "../components/Pagination";
import { FeedFilters } from "./feed/FeedFilters";

const PAGE_SIZE = 15;
const VALID_SORTS: AuctionSort[] = ["ending_soon", "price_asc", "price_desc", "most_bids"];

export function FeedPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const genre = searchParams.get("genre") ?? "";
    const pressType = searchParams.get("pressType") ?? "";
    // 기본은 진행 중만. "종료 포함"을 켜면 상태 필터를 풀어 전체(진행·예정·종료)를 본다 —
    // 목록 API가 상태를 하나만 받아서, 포함 토글은 필터 해제로 구현한다
    const includeEnded = searchParams.get("ended") === "1";
    const sortParam = searchParams.get("sort");
    const sort = VALID_SORTS.includes(sortParam as AuctionSort) ? (sortParam as AuctionSort) : "ending_soon";
    const page = Math.max(0, Number(searchParams.get("page") ?? "0") || 0);

    function patchParams(patch: Partial<Record<string, string | null>>, resetPage = true) {
        const next = new URLSearchParams(searchParams);
        for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === undefined || value === "") next.delete(key);
            else next.set(key, value);
        }
        if (resetPage) next.set("page", "0");
        if (next.get("page") === "0") next.delete("page");
        setSearchParams(next, { replace: resetPage });
    }

    const query = useQuery({
        queryKey: ["auctions", "feed", genre, pressType, includeEnded, sort, page],
        queryFn: () =>
            fetchAuctions({
                genre: genre || undefined,
                pressType: pressType || undefined,
                status: includeEnded ? undefined : "RUNNING",
                sort,
                page,
                size: PAGE_SIZE,
            }),
        placeholderData: keepPreviousData,
    });

    // "종료 포함"은 상태 필터 해제(전체 조회)로 구현되어 시작 전 경매까지 섞여 나온다.
    // 피드는 시작 전을 노출하지 않기로 해서 클라이언트에서 걸러낸다 — 시작 전 경매 수만큼
    // 페이지가 살짝 덜 차 보일 수 있지만, 상태 필터를 하나만 받는 API 제약상의 절충이다
    const items = (query.data?.items ?? []).filter((auction) => auction.status !== "SCHEDULED");

    return (
        <div>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="font-display text-3xl font-bold tracking-tight">경매 피드</h2>
                    <p className="mt-1.5 text-[13.5px] text-muted">진행 중인 경매를 마감 순서로 봅니다.</p>
                </div>
                <Link
                    to="/auctions/new"
                    className="rounded-xl bg-ink px-5 py-2.5 text-[13.5px] font-extrabold text-paper transition-opacity hover:opacity-90"
                >
                    + 경매 등록하기
                </Link>
            </div>
            <FeedFilters values={{ genre, pressType, includeEnded, sort }} onChange={patchParams} />
            <QueryState
                isLoading={query.isPending}
                error={query.error}
                onRetry={() => query.refetch()}
                isEmpty={!query.data || items.length === 0}
                emptyMessage={
                    <div>
                        조건에 맞는 경매가 없습니다.
                        <div className="mt-3 flex justify-center gap-2">
                            {!includeEnded && (
                                <button
                                    type="button"
                                    onClick={() => patchParams({ ended: "1" })}
                                    className="rounded-lg border border-line bg-paper px-4 py-2 text-sm font-semibold hover:border-line-strong"
                                >
                                    종료된 경매 포함해 보기
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setSearchParams({}, { replace: true })}
                                className="rounded-lg border border-line bg-paper px-4 py-2 text-sm font-semibold hover:border-line-strong"
                            >
                                필터 초기화
                            </button>
                        </div>
                    </div>
                }
            >
                <div
                    className={`grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5 ${
                        query.isFetching ? "opacity-60" : ""
                    }`}
                >
                    {items.map((auction) => (
                        <AuctionCard key={auction.auctionId} auction={auction} />
                    ))}
                </div>
                {query.data && (
                    <Pagination
                        page={page}
                        hasNext={query.data.hasNext}
                        totalElements={query.data.totalElements}
                        size={PAGE_SIZE}
                        onPage={(next) => patchParams({ page: String(next) }, false)}
                    />
                )}
            </QueryState>
        </div>
    );
}
