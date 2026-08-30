interface PaginationProps {
    page: number;
    hasNext: boolean;
    totalElements?: number;
    // 총 개수 없이 페이지 수만 내려주는 API(지갑 거래 내역)용 — 있으면 totalElements 계산보다 우선한다
    totalPageCount?: number;
    size: number;
    onPage: (page: number) => void;
}

// 현재 페이지를 가운데 두고 최대 5칸을 보여준다 (양 끝에서는 한쪽으로 몰아 5칸 유지)
function pageWindow(page: number, totalPages: number): number[] {
    const start = Math.max(0, Math.min(page - 2, totalPages - 5));
    return Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
}

export function Pagination({ page, hasNext, totalElements, totalPageCount, size, onPage }: PaginationProps) {
    const totalPages =
        totalPageCount ?? (totalElements !== undefined ? Math.max(1, Math.ceil(totalElements / size)) : null);
    const arrowClass =
        "grid h-[34px] min-w-[34px] place-items-center rounded-lg border border-line bg-surface text-sm font-semibold text-muted transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-40";
    return (
        <nav aria-label="페이지 이동" className="mt-8 flex items-center justify-center gap-1.5">
            <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} className={arrowClass} aria-label="이전 페이지">
                ‹
            </button>
            {totalPages !== null ? (
                pageWindow(page, totalPages).map((p) => (
                    <button
                        key={p}
                        type="button"
                        aria-current={p === page ? "page" : undefined}
                        onClick={() => onPage(p)}
                        className={`grid h-[34px] min-w-[34px] place-items-center rounded-lg font-mono text-[13px] font-bold tabular-nums transition-colors ${
                            p === page ? "bg-ink text-paper" : "text-muted hover:bg-surface2 hover:text-ink"
                        }`}
                    >
                        {p + 1}
                    </button>
                ))
            ) : (
                <span className="px-2 font-mono text-sm text-muted tabular-nums">{page + 1}</span>
            )}
            <button type="button" disabled={!hasNext} onClick={() => onPage(page + 1)} className={arrowClass} aria-label="다음 페이지">
                ›
            </button>
        </nav>
    );
}
