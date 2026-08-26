import { apiGet } from "./client";

// product-service /api/v1/recommendations — 찜 목록 기반 추천. 가중치는 사전 계산된 캐시만 조회해
// 항상 빠르게 응답하므로(요청 경로에서 LLM을 기다리지 않음) 별도 폴링·긴 로딩 처리가 필요 없다
export interface Recommendation {
    productId: number;
    title: string;
    artistName: string;
    coverImageUrl: string | null;
    releaseYear: number | null;
}

export const RECOMMENDATION_SIZE = 10;

export function fetchRecommendations(size = RECOMMENDATION_SIZE): Promise<Recommendation[]> {
    return apiGet<Recommendation[]>(`/api/v1/recommendations?size=${size}`);
}
