import { GENRES } from "../../api/products";

export interface FeedFilterValues {
    genre: string;
    pressType: string;
    includeEnded: boolean;
    sort: string;
}

interface FeedFiltersProps {
    values: FeedFilterValues;
    onChange: (patch: Partial<Record<"genre" | "pressType" | "ended" | "sort", string | null>>) => void;
}

const PRESS_TYPES = [
    { value: "ORIGINAL", label: "오리지널" },
    { value: "REISSUE", label: "재발매" },
];

const SORTS = [
    { value: "ending_soon", label: "마감 임박순" },
    { value: "price_desc", label: "현재가 높은순" },
    { value: "price_asc", label: "현재가 낮은순" },
    { value: "most_bids", label: "입찰 많은순" },
];

export function FeedFilters({ values, onChange }: FeedFiltersProps) {
    return (
        <div className="mb-6 flex flex-wrap items-center gap-2.5 border-y border-line py-3">
            <select
                value={values.genre}
                onChange={(e) => onChange({ genre: e.target.value || null })}
                aria-label="장르 필터"
                className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] font-semibold outline-none"
            >
                <option value="">전체 장르</option>
                {GENRES.map((g) => (
                    <option key={g.value} value={g.value}>
                        {g.label}
                    </option>
                ))}
            </select>
            <span className="h-5 w-px bg-line" />
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
            {/* 종료 경매는 기본에서 빼되, 켜면 낙찰가가 시세 참고가 된다 — 진행 중이 적을 때 피드가 비는 것도 막는다 */}
            <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px] font-bold text-muted">
                <input
                    type="checkbox"
                    checked={values.includeEnded}
                    onChange={(e) => onChange({ ended: e.target.checked ? "1" : null })}
                    className="h-4 w-4 accent-[var(--color-brand)]"
                />
                종료된 경매 포함
            </label>
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
