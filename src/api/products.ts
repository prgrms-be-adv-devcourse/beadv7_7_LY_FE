import { apiGet } from "./client";

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
