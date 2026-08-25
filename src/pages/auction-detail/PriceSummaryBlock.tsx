import type { ReactNode } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { getPriceSummary, type ConditionPriceSummary } from "../../api/products";
import { formatCondition } from "../../api/auctions";
import { formatWon } from "../../components/AuctionCard";

// 같은 컨디션 낙찰이 이만큼 있어야 "비교"로 단정한다. 임의 기준이라 데이터가 쌓이면 튜닝 대상
const MIN_SAMPLE_COUNT = 3;
// 차이가 이 미만이면 낮다/높다 대신 "비슷"으로 표시한다
const SIMILAR_THRESHOLD = 0.01;

// "VG+ (약간의 사용감)" → "VG+" — 좁은 라벨 자리에는 등급 기호만 쓴다
function shortCondition(condition: string): string {
    return formatCondition(condition).split(" ")[0];
}

function sumSamples(items: ConditionPriceSummary[]): number {
    return items.reduce((acc, item) => acc + item.sampleCount, 0);
}

function weightedAverage(items: ConditionPriceSummary[]): number {
    const total = sumSamples(items);
    return items.reduce((acc, item) => acc + item.averagePrice * item.sampleCount, 0) / total;
}

interface PriceSummaryBlockProps {
    productId: number;
    itemCondition: string;
    currentPrice: number;
}

// 입찰 박스 안의 시세 요약 — 그래프는 상품 상세에 있고, 여기는 판단 재료만 준다.
// 같은 컨디션 낙찰이 충분하면 현재가와 비교(배지)까지 하고, 부족하면 M/NM 평균을
// 참고로만 보여준다 — 상급 컨디션 시세와 비교해 "낮음" 배지를 달면 당연히 낮은 것을
// 기회처럼 보이게 하는 왜곡이 생기기 때문
export function PriceSummaryBlock({ productId, itemCondition, currentPrice }: PriceSummaryBlockProps) {
    const summary = useQuery({
        queryKey: ["product", "priceSummary", productId],
        queryFn: () => getPriceSummary(productId),
        staleTime: 60_000,
    });

    // 시세는 부가 정보라 로딩·실패 시 입찰 박스를 방해하지 않고 조용히 빠진다
    if (!summary.data) return null;

    const conditions = summary.data.conditions;
    const same = conditions.find(
        (c) => c.condition === itemCondition && c.sampleCount >= MIN_SAMPLE_COUNT,
    );
    const graded = conditions.filter((c) => c.condition === "MINT" || c.condition === "NEAR_MINT");

    let body: ReactNode;
    if (same) {
        const diff = (currentPrice - same.averagePrice) / same.averagePrice;
        const percent = Math.round(Math.abs(diff) * 100);
        const badge =
            Math.abs(diff) < SIMILAR_THRESHOLD
                ? { text: "시세와 비슷", className: "bg-surface2 text-muted" }
                : diff < 0
                    ? { text: `시세보다 ${percent}% 낮음`, className: "bg-up-bg text-up" }
                    : { text: `시세보다 ${percent}% 높음`, className: "bg-live-bg text-live" };
        body = (
            <>
                <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-faint">이 판의 시세</span>
                    <span className="text-[10.5px] text-faint">
                        {shortCondition(itemCondition)} 낙찰 기준 ·{" "}
                        <span className="font-mono tabular-nums">{same.sampleCount}</span>건
                    </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2.5">
                    <span className="font-mono text-[17px] font-bold tabular-nums">
                        {formatWon(Math.round(same.averagePrice))}
                        <small className="ml-1 font-sans text-[11px] font-semibold text-muted">평균 낙찰가</small>
                    </span>
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${badge.className}`}>
                        {badge.text}
                    </span>
                </div>
            </>
        );
    } else if (sumSamples(graded) > 0) {
        body = (
            <>
                <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-faint">이 판의 시세</span>
                    <span className="text-[10.5px] text-faint">
                        M/NM 낙찰 기준 · <span className="font-mono tabular-nums">{sumSamples(graded)}</span>건
                    </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2.5">
                    <span className="font-mono text-[17px] font-bold tabular-nums">
                        {formatWon(Math.round(weightedAverage(graded)))}
                        <small className="ml-1 font-sans text-[11px] font-semibold text-muted">평균 낙찰가</small>
                    </span>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                    이 매물({shortCondition(itemCondition)})과 컨디션이 달라 참고용입니다.
                </p>
            </>
        );
    } else {
        body = (
            <>
                <span className="text-[11px] font-bold uppercase tracking-wider text-faint">이 판의 시세</span>
                <p className="mt-1.5 text-[13px] font-semibold text-muted">아직 낙찰 기록이 부족합니다</p>
            </>
        );
    }

    return (
        <div className="mt-3.5 rounded-xl border border-line bg-paper px-3.5 py-3">
            {body}
            <Link
                to={`/products/${productId}`}
                className="mt-2 inline-block text-[12px] font-semibold text-brand underline underline-offset-2 hover:text-brand-ink"
            >
                시세 전체 보기 →
            </Link>
        </div>
    );
}
