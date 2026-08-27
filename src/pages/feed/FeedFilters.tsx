export interface FeedFilterValues {
    genre: string;
    pressType: string;
    status: string;
    sort: string;
}

interface FeedFiltersProps {
    values: FeedFilterValues;
    onChange: (patch: Partial<Record<"genre" | "pressType" | "status" | "sort", string | null>>) => void;
}

// 백엔드가 product.genre와 정확 일치로 비교하므로 DB에 실재하는 값(Discogs 장르 표기)만 넣는다.
// 목록은 시드 데이터의 상위 장르 순 — 여기 없는 값을 넣으면 그 필터는 항상 0건이 된다
const GENRES = [
    "Rock",
    "Jazz",
    "Classical",
    "Electronic",
    "Folk, World, & Country",
    "Pop",
    "Funk / Soul",
    "Hip Hop",
    "Reggae",
    "Blues",
];

const PRESS_TYPES = [
    { value: "ORIGINAL", label: "오리지널" },
    { value: "REISSUE", label: "재발매" },
];

// 종료된 경매(낙찰·유찰)는 피드에 내놓지 않는다 — 시간이 지날수록 죽은 매물이 목록을 지배하게 되고,
// 낙찰가 확인은 상품 상세의 시세가, 내 경매 결과는 마이페이지가 담당한다
const STATUSES = [
    { value: "RUNNING", label: "진행 중" },
    { value: "SCHEDULED", label: "시작 전" },
];

const SORTS = [
    { value: "ending_soon", label: "마감 임박순" },
    { value: "price_desc", label: "현재가 높은순" },
    { value: "price_asc", label: "현재가 낮은순" },
    { value: "most_bids", label: "입찰 많은순" },
];

export function FeedFilters({ values, onChange }: FeedFiltersProps) {
    return (
        <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <select
                value={values.genre}
                onChange={(e) => onChange({ genre: e.target.value || null })}
                aria-label="장르 필터"
                className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] font-semibold outline-none"
            >
                <option value="">전체 장르</option>
                {GENRES.map((g) => (
                    <option key={g} value={g}>
                        {g}
                    </option>
                ))}
            </select>
            <span className="h-5 w-px bg-line" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-faint">프레스</span>
            {PRESS_TYPES.map((p) => (
                <button
                    key={p.value}
                    type="button"
                    aria-pressed={values.pressType === p.value}
                    onClick={() => onChange({ pressType: values.pressType === p.value ? null : p.value })}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        values.pressType === p.value
                            ? "border-brand bg-brand text-white"
                            : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
                    }`}
                >
                    {p.label}
                </button>
            ))}
            <span className="h-5 w-px bg-line" />
            <div role="radiogroup" aria-label="상태 필터" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
                {STATUSES.map((s) => {
                    const selected = values.status === s.value;
                    return (
                        <button
                            key={s.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            // 진행 중은 기본값이라 URL에서 status를 지운다 — 필터 없는 기존 공유 링크와 같은 형태 유지
                            onClick={() => onChange({ status: s.value === "RUNNING" ? null : s.value })}
                            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                                selected ? "bg-brand text-white" : "text-muted hover:text-ink"
                            }`}
                        >
                            {s.label}
                        </button>
                    );
                })}
            </div>
            <select
                value={values.sort}
                onChange={(e) => onChange({ sort: e.target.value })}
                aria-label="정렬"
                className="ml-auto rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] font-semibold outline-none"
            >
                {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                        {s.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
