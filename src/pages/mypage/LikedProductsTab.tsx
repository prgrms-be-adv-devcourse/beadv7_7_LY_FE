import { Link } from "react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchLikedProducts } from "../../api/wishlist";
import { fetchRecommendations } from "../../api/recommendations";
import { QueryState } from "../../components/QueryState";
import { VinylCover } from "../../components/VinylCover";
import { LikeButton } from "../../components/LikeButton";

export function LikedProductsTab() {
    // 이 목록만 페이지 번호가 아니라 커서로 넘어와서, 다음 장을 이어 붙이는 방식으로 그린다
    const query = useInfiniteQuery({
        queryKey: ["wishlist", "likedProducts"],
        queryFn: ({ pageParam }) => fetchLikedProducts(pageParam),
        initialPageParam: null as number | null,
        getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.nextCursor : undefined),
    });

    const items = query.data?.pages.flatMap((page) => page.content) ?? [];

    return (
        <div>
            <h3 className="mb-1 text-base font-bold tracking-tight">찜한 상품</h3>
            <p className="mb-4 text-[13.5px] text-muted">
                카탈로그에서 하트를 누른 음반입니다. 하트를 다시 누르면 목록에서 빠집니다.
            </p>

            <QueryState
                isLoading={query.isPending}
                error={query.error}
                isEmpty={items.length === 0}
                emptyMessage="아직 찜한 상품이 없습니다. 카탈로그에서 하트를 눌러 담아보세요."
            >
                <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
                    {items.map((item) => (
                        <Link
                            key={item.id}
                            to={`/products/${item.productId}`}
                            className="rounded-xl border border-line bg-surface p-3 shadow-sm transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-line-strong"
                        >
                            <div className="relative">
                                <VinylCover
                                    title={item.title}
                                    artist={item.artistName}
                                    imageUrl={item.coverImageUrl}
                                />
                                <LikeButton productId={item.productId} />
                            </div>
                            <div className="mt-2.5 truncate font-display text-sm font-bold">{item.title}</div>
                            <div className="truncate text-xs text-muted">
                                {item.artistName}
                                {item.releaseYear ? ` · ${item.releaseYear}` : ""}
                            </div>
                        </Link>
                    ))}
                </div>
                {query.hasNextPage && (
                    <div className="mt-6 text-center">
                        <button
                            type="button"
                            disabled={query.isFetchingNextPage}
                            onClick={() => query.fetchNextPage()}
                            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold hover:border-line-strong disabled:opacity-50"
                        >
                            {query.isFetchingNextPage ? "불러오는 중…" : "더 보기"}
                        </button>
                    </div>
                )}
            </QueryState>

            <RecommendationsSection />
        </div>
    );
}

function RecommendationsSection() {
    // 찜한 상품을 근거로 계산되는 추천이라, 찜 목록이 비면 이 목록도 함께 비어 있는 게 정상 응답이다
    const query = useQuery({
        queryKey: ["wishlist", "recommendations"],
        queryFn: () => fetchRecommendations(),
    });

    const items = query.data ?? [];

    return (
        <div className="mt-10 border-t border-line pt-8">
            <h3 className="mb-1 text-base font-bold tracking-tight">회원님을 위한 추천</h3>
            <p className="mb-4 text-[13.5px] text-muted">찜한 상품을 바탕으로 골라봤어요.</p>

            <QueryState
                isLoading={query.isPending}
                error={query.error}
                isEmpty={items.length === 0}
                emptyMessage="카탈로그에서 음반을 찜하면 여기서 추천을 볼 수 있어요."
                onRetry={() => query.refetch()}
            >
                <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
                    {items.map((item) => (
                        <Link
                            key={item.productId}
                            to={`/products/${item.productId}`}
                            className="rounded-xl border border-line bg-surface p-3 shadow-sm transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-line-strong"
                        >
                            <div className="relative">
                                <VinylCover
                                    title={item.title}
                                    artist={item.artistName}
                                    imageUrl={item.coverImageUrl}
                                />
                                <LikeButton productId={item.productId} />
                            </div>
                            <div className="mt-2.5 truncate font-display text-sm font-bold">{item.title}</div>
                            <div className="truncate text-xs text-muted">
                                {item.artistName}
                                {item.releaseYear ? ` · ${item.releaseYear}` : ""}
                            </div>
                        </Link>
                    ))}
                </div>
            </QueryState>
        </div>
    );
}
