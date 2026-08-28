import { apiGet, apiPost } from "./client";

export interface ProductSearchCard {
    productId: number;
    title: string;
    artistName: string;
    coverImageUrl: string | null;
    releaseYear: number;
    pressType: string;
}

export interface ProductSearchResponse {
    content: ProductSearchCard[];
    page: number;
    size: number;
    totalElements: number;
    hasNext: boolean;
    // 이 검색을 가리키는 값. 결과를 눌렀을 때 그대로 돌려보내면 서버가 클릭을 이 검색에 이어 붙인다.
    // 검색어를 바꾸거나 페이지를 넘기면 새 값이 오므로, 지금 화면에 보이는 결과를 만든 응답의 값을 써야 한다
    searchId: string;
}

export interface ProductDetail {
    productId: number;
    catalogNo: string;
    title: string;
    artist: { artistId: number; name: string };
    label: string;
    country: string;
    releaseYear: number;
    pressType: string;
    format: string;
    genre: string;
    coverImageUrl: string | null;
    description: string | null;
}

// GET /api/v1/products/{id}/price-trades — 원장 기반 낙찰 이력 (시세 추이용)
export interface TradePoint {
    condition: string;
    price: number;
    tradedAt: string;
}

export interface PriceTradesResponse {
    productId: number;
    trades: TradePoint[];
}

export function getPriceTrades(productId: string | number): Promise<PriceTradesResponse> {
    return apiGet<PriceTradesResponse>(`/api/v1/products/${productId}/price-trades`);
}

// GET /api/v1/products/{id}/price-summary — 컨디션별 낙찰가 통계 (거래가 있는 컨디션만 내려온다)
export interface ConditionPriceSummary {
    condition: string;
    sampleCount: number;
    averagePrice: number;
    lowestPrice: number;
    highestPrice: number;
}

export interface PriceSummaryResponse {
    productId: number;
    conditions: ConditionPriceSummary[];
}

export function getPriceSummary(productId: string | number): Promise<PriceSummaryResponse> {
    return apiGet<PriceSummaryResponse>(`/api/v1/products/${productId}/price-summary`);
}

// 검색 대상 — 서버는 검색어가 번호인지 추측하지 않으므로 사용자가 고른 값을 그대로 보낸다
export type ProductSearchBy = "name" | "catalog";

// 서버가 product.genre와 정확히 일치로 비교하므로 value는 데이터에 실재하는 표기(Discogs 장르)를
// 그대로 쓴다 — 여기 없는 값을 넣으면 그 장르는 항상 0건이 된다.
// 목록은 시드 데이터의 상위 장르 순. 홈 타일과 피드 필터가 같은 목록을 봐야 서로 어긋나지 않는다
export const GENRES = [
    { value: "Rock", label: "록" },
    { value: "Jazz", label: "재즈" },
    { value: "Classical", label: "클래식" },
    { value: "Electronic", label: "일렉트로닉" },
    { value: "Folk, World, & Country", label: "포크·월드" },
    { value: "Pop", label: "팝" },
    { value: "Funk / Soul", label: "펑크·소울" },
    { value: "Hip Hop", label: "힙합" },
    { value: "Reggae", label: "레게" },
    { value: "Blues", label: "블루스" },
] as const;

export function searchProducts(
    q: string,
    page: number,
    size = 20,
    signal?: AbortSignal,
    searchBy: ProductSearchBy = "name",
): Promise<ProductSearchResponse> {
    const params = new URLSearchParams({ q, page: String(page), size: String(size) });
    // 이름 검색은 searchBy를 생략한다 — 서버 기본값이 이름 검색이라 요청 형태가 기존과 같아진다
    if (searchBy === "catalog") {
        params.set("searchBy", "catalog");
    }
    // signal: 새 검색이 시작되면 이전 요청을 취소한다 — 연결이 끊기면 서버(MySQL) 쿼리도 중단된다
    return apiGet<ProductSearchResponse>(`/api/v1/search/products?${params}`, signal);
}

// POST /api/v1/search/clicks — 검색 결과 중 무엇을 눌렀는지 서버에 남긴다.
// 검색 품질을 사람이 정한 정답이 아니라 실제 사용자 행동으로 재기 위한 기록이다.
//
// rank는 전체 결과에서 몇 번째인지다(1부터, 페이지를 넘어가도 이어 센다). 페이지마다 1로 되돌리면
// "1페이지의 1번"과 "3페이지의 1번"이 같은 값이 되어, 원하는 것을 찾기까지 얼마나 내려갔는지 알 수 없다.
//
// 결과를 기다리지 않고 보내기만 한다 — 사용자는 상품 상세로 넘어가는 중이고, 기록이 실패해도
// 그 이동이 막히면 안 된다. 유실돼도 통계가 조금 비는 것뿐이다.
export function recordSearchClick(searchId: string, productId: number, rank: number): void {
    void apiPost("/api/v1/search/clicks", { searchId, productId, rank }).catch(() => {
        // 기록 실패는 삼킨다
    });
}

// GET /api/v1/products — 카탈로그 둘러보기 목록.
// 검색(/search/products)과 달리 최근 낙찰가와 진행 중 경매 수까지 같이 내려준다.
export interface ProductListCard {
    productId: number;
    title: string;
    artistName: string;
    coverImageUrl: string | null;
    releaseYear: number;
    pressType: string;
    country: string | null;
    // 낙찰된 적이 없으면 null. 경매 수는 경매 쪽 조회가 실패했을 때도 null로 온다
    lastTradedPrice: number | null;
    openAuctionCount: number | null;
}

export interface ProductListResponse {
    content: ProductListCard[];
    page: number;
    size: number;
    totalElements: number;
    hasNext: boolean;
}

export function fetchProductList(page: number, size = 20): Promise<ProductListResponse> {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    return apiGet<ProductListResponse>(`/api/v1/products?${params}`);
}

export function getProductDetail(productId: string | number): Promise<ProductDetail> {
    return apiGet<ProductDetail>(`/api/v1/products/${productId}`);
}
