import type { ProductSearchBy } from "../api/products";

const OPTIONS: { value: ProductSearchBy; label: string }[] = [
    { value: "name", label: "제목·아티스트" },
    { value: "catalog", label: "카탈로그 번호" },
];

interface SearchByToggleProps {
    value: ProductSearchBy;
    onChange: (next: ProductSearchBy) => void;
}

// 검색어가 번호인지 서버가 추측하지 않는다(일반 단어로 시작하는 번호가 있어 오답이 최상위로 올라온다).
// 그래서 무엇을 찾는지는 사용자가 여기서 직접 고른다
export function SearchByToggle({ value, onChange }: SearchByToggleProps) {
    return (
        <div role="radiogroup" aria-label="검색 대상" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
            {OPTIONS.map((option) => {
                const selected = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onChange(option.value)}
                        className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                            selected ? "bg-brand text-white" : "text-muted hover:text-ink"
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
