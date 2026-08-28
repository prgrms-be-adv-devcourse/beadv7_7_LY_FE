// 홈에서 쓰는 큐레이션 자산. 상품 카탈로그는 Discogs 시드 기반 읽기 전용이라(수정·삭제 없음)
// 커버 URL과 productId를 고정해도 깨지지 않는다. 검색 색인에 유명도 점수가 실리면(v2 재색인)
// 이 고정 목록은 유명도순 API 응답으로 대체한다.

/** 히어로 콜라주에 까는 커버 15장 — 운영 DB에서 커버가 있는 상품을 골라둔 것 */
export const COLLAGE_COVERS: string[] = [
    "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499991.jpg",
    "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499975.jpg",
    "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499959.jpg",
    "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499932.jpg",
    "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499880.jpg",
    "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499868.jpg",
    "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499867.jpg",
    "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499863.jpg",
    "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499853.jpg",
    "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499833.jpg",
    "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499830.jpg",
    "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499825.jpg",
    "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499806.jpg",
    "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499800.jpg",
    "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499748.jpg",
];

/** 장르 타일의 대표 커버. 없는 장르(레게·블루스)는 타일이 생성 커버 폴백으로 그린다 */
export const GENRE_COVERS: Record<string, string> = {
    "Rock": "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499867.jpg",
    "Jazz": "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499853.jpg",
    "Classical": "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499833.jpg",
    "Electronic": "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499830.jpg",
    "Folk, World, & Country": "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499975.jpg",
    "Pop": "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499991.jpg",
    "Funk / Soul": "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499825.jpg",
    "Hip Hop": "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499868.jpg",
};

export interface SpotlightItem {
    productId: number;
    title: string;
    artistName: string;
    coverImageUrl: string;
    releaseYear: number;
    pressType: string;
}

/** "둘러볼 만한 판" 6장 */
export const SPOTLIGHT_ITEMS: SpotlightItem[] = [
    { productId: 435205, title: "Lost: Season 3 (Original Television Soundtrack)", artistName: "Michael Giacchino", coverImageUrl: "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499863.jpg", releaseYear: 2026, pressType: "REISSUE" },
    { productId: 435220, title: "Little Miss Twain", artistName: "Shania Twain", coverImageUrl: "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499880.jpg", releaseYear: 2026, pressType: "REISSUE" },
    { productId: 435258, title: "Los Dúo", artistName: "Juan Gabriel", coverImageUrl: "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499932.jpg", releaseYear: 2026, pressType: "ORIGINAL" },
    { productId: 435166, title: "All Killer No Filler", artistName: "Sum 41", coverImageUrl: "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499800.jpg", releaseYear: 2026, pressType: "REISSUE" },
    { productId: 435294, title: "Suicide Season", artistName: "Bring Me The Horizon", coverImageUrl: "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499959.jpg", releaseYear: 2026, pressType: "ORIGINAL" },
    { productId: 435119, title: "Originalyn", artistName: "Hyolyn", coverImageUrl: "https://team04-ly.s3.ap-northeast-2.amazonaws.com/covers/499748.jpg", releaseYear: 2026, pressType: "ORIGINAL" },
];
