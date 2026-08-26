import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchProducts } from "../../api/products";
import { VinylCover } from "../../components/VinylCover";

export interface PickedProduct {
    productId: number;
    title: string;
    artistName: string;
    coverImageUrl: string | null;
}

interface ProductPickerProps {
    picked: PickedProduct | null;
    onPick: (product: PickedProduct | null) => void;
}

// 경매는 카탈로그에 이미 있는 음반(마스터 상품)에만 걸 수 있다.
// 새 음반을 만드는 화면이 아니라 기존 음반을 찾아 고르는 화면이다
export function ProductPicker({ picked, onPick }: ProductPickerProps) {
    const [keyword, setKeyword] = useState("");
    // 검색은 엔터/버튼에서만 실행한다 — 검색 쿼리가 서버에서 수 초짜리라 타이핑마다 쏘면 겹쳐서 느려진다
    const [submitted, setSubmitted] = useState("");
    const [tooShort, setTooShort] = useState(false);

    const results = useQuery({
        // 키에 "picker"를 넣어 카탈로그 검색과 캐시를 분리한다 — 같은 키를 쓰면 요청 크기가
        // 다른(100건 vs 20건) 두 화면이 서로의 응답을 재사용해 결과 수가 틀리게 보인다
        queryKey: ["productSearch", "picker", submitted],
        // 페이지 이동 없이 한 번에 넉넉히 받아 스크롤로 보여준다 — 100건 안에 없으면 검색어를 좁히는 게 빠르다
        queryFn: ({ signal }) => searchProducts(submitted, 0, 100, signal),
        enabled: submitted.length >= 2 && picked === null,
        retry: 0,
    });

    function runSearch() {
        const next = keyword.trim();
        if (next.length < 2) {
            setTooShort(true);
            return;
        }
        setTooShort(false);
        setSubmitted(next);
    }

    if (picked) {
        return (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                <VinylCover
                    title={picked.title}
                    artist={picked.artistName}
                    imageUrl={picked.coverImageUrl}
                    className="w-14 shrink-0"
                />
                <div className="min-w-0 grow">
                    <p className="truncate font-semibold">{picked.title}</p>
                    <p className="truncate text-[13px] text-muted">{picked.artistName}</p>
                    <p className="font-mono text-[11px] text-faint">상품번호 {picked.productId}</p>
                </div>
                <button
                    type="button"
                    onClick={() => onPick(null)}
                    className="shrink-0 rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-muted hover:border-line-strong hover:text-ink"
                >
                    다시 고르기
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex gap-2">
                <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => {
                        // 경매 등록 폼(form) 안이라 엔터가 폼 제출로 새면 안 된다 — 여기서 잡아 검색만 실행
                        if (e.key === "Enter") {
                            e.preventDefault();
                            runSearch();
                        }
                    }}
                    placeholder="앨범 제목·아티스트·카탈로그 번호 (2글자 이상)"
                    aria-label="마스터 상품 검색"
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-line-strong"
                />
                <button
                    type="button"
                    onClick={runSearch}
                    disabled={results.isFetching}
                    className="shrink-0 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                    {results.isFetching ? "검색 중…" : "검색"}
                </button>
            </div>
            {tooShort && (
                <p className="mt-2 text-[12px] font-semibold text-live">검색어를 2글자 이상 입력해주세요.</p>
            )}
            {submitted.length === 0 && !tooShort && (
                <p className="mt-2 text-[12px] text-muted">
                    카탈로그에 등록된 음반만 경매로 올릴 수 있습니다. 검색해서 고르세요.
                </p>
            )}
            {submitted.length > 0 && results.isPending && (
                <p className="mt-2 text-[12px] text-muted">검색 중…</p>
            )}
            {results.error && (
                <p className="mt-2 text-[12px] font-semibold text-live">상품 검색에 실패했습니다.</p>
            )}
            {results.data && results.data.content.length === 0 && (
                <p className="mt-2 text-[12px] text-muted">
                    ‘{submitted}’ 검색 결과가 없습니다. 앨범 제목이나 아티스트 이름을 바꿔 다시 검색해보세요.
                </p>
            )}
            {results.data && results.data.content.length > 0 && (
                <ul className="mt-2 flex max-h-80 flex-col gap-1.5 overflow-y-auto pr-1">
                    {results.data.content.map((card) => (
                        <li key={card.productId}>
                            <button
                                type="button"
                                onClick={() =>
                                    onPick({
                                        productId: card.productId,
                                        title: card.title,
                                        artistName: card.artistName,
                                        coverImageUrl: card.coverImageUrl,
                                    })
                                }
                                className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-line-strong"
                            >
                                <VinylCover
                                    title={card.title}
                                    artist={card.artistName}
                                    imageUrl={card.coverImageUrl}
                                    className="w-10 shrink-0"
                                />
                                <span className="min-w-0 grow">
                                    <span className="block truncate text-[13.5px] font-semibold">{card.title}</span>
                                    <span className="block truncate text-[12px] text-muted">
                                        {card.artistName} · {card.releaseYear}
                                    </span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
