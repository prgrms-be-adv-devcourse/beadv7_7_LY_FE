import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAuctions } from "../api/auctions";
import { fetchRecentTrades, GENRES } from "../api/products";
import { AuctionCard, formatWon } from "../components/AuctionCard";
import { formatAgo } from "../lib/format";
import { COLLAGE_COVERS, GENRE_COVERS, SPOTLIGHT_ITEMS } from "./home/curated";

// 홈 전용 짧은 컨디션 표기 (백엔드 MediaCondition enum 이름 기준)
const CONDITION_SHORT: Record<string, string> = {
    MINT: "M",
    NEAR_MINT: "NM",
    VERY_GOOD_PLUS: "VG+",
    VERY_GOOD: "VG",
    GOOD: "G",
    POOR: "P",
};

// 본문 컨테이너(max-w + px-5)를 뚫고 화면 전체 폭을 쓰는 띠 — 히어로와 절차 밴드가 쓴다
const FULL_BLEED = "mx-[calc(50%-50vw)]";

export function HomePage() {
    const ending = useQuery({
        queryKey: ["auctions", "home-ending"],
        queryFn: () => fetchAuctions({ status: "RUNNING", sort: "ending_soon", page: 0, size: 8 }),
    });
    const trades = useQuery({
        queryKey: ["recentTrades"],
        queryFn: () => fetchRecentTrades(6),
        staleTime: 60_000,
    });

    const endingItems = ending.data?.items ?? [];
    const recentTrades = trades.data?.trades ?? [];

    return (
        <div>
            <HeroBand />

            <section className="mt-12">
                <SectionHead eyebrow="Browse by Genre" eyebrowClass="text-brand" title="장르로 둘러보기" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {GENRES.map((genre) => (
                        <GenreTile key={genre.value} value={genre.value} label={genre.label} />
                    ))}
                </div>
            </section>

            {/* 진행 중 경매가 없으면 빈 박스 대신 섹션을 통째로 숨긴다 — 아래 섹션들이 홈을 채운다 */}
            {endingItems.length > 0 && (
                <section className="mt-12">
                    <SectionHead
                        eyebrow="지금 마감 임박"
                        eyebrowClass="text-live"
                        title="곧 종료되는 경매"
                        link={{ to: "/feed", label: "경매 피드 전체 →" }}
                    />
                    <div className="flex snap-x gap-3.5 overflow-x-auto pb-2">
                        {endingItems.map((auction) => (
                            <AuctionCard key={auction.auctionId} auction={auction} className="w-[220px] flex-none snap-start" />
                        ))}
                    </div>
                </section>
            )}

            <section className="mt-12">
                <SectionHead
                    eyebrow="Catalog Picks"
                    eyebrowClass="text-brand"
                    title="둘러볼 만한 판"
                    link={{ to: "/catalog", label: "카탈로그 전체 →" }}
                />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                    {SPOTLIGHT_ITEMS.map((item) => (
                        <Link key={item.productId} to={`/products/${item.productId}`} className="group min-w-0">
                            <div
                                className="aspect-square rounded-xl bg-cover bg-center shadow-md transition-transform duration-300 group-hover:-translate-y-1"
                                style={{ backgroundImage: `url(${item.coverImageUrl})` }}
                            />
                            <p className="mt-2.5 truncate text-[13px] font-bold">{item.title}</p>
                            <p className="truncate text-[12px] font-semibold text-muted">{item.artistName}</p>
                            <p className="mt-0.5 text-[11px] font-semibold text-faint">
                                {item.releaseYear} · {item.pressType === "ORIGINAL" ? "오리지널" : "재발매"}
                            </p>
                        </Link>
                    ))}
                </div>
            </section>

            {/* 최근 낙찰 — 전역 시세 API가 비어 있거나 실패하면 섹션을 그리지 않는다 */}
            {recentTrades.length > 0 && (
                <section className="mt-12">
                    <SectionHead
                        eyebrow="Sold on Groovid"
                        eyebrowClass="text-up"
                        title="최근 낙찰"
                        link={{ to: "/catalog", label: "시세 더 보기 →" }}
                    />
                    <div className="grid grid-cols-1 gap-x-8 border-t border-line md:grid-cols-3">
                        {recentTrades.map((trade, i) => (
                            <Link
                                key={`${trade.productId}-${trade.tradedAt}-${i}`}
                                to={`/products/${trade.productId}`}
                                className="flex items-center gap-3 border-b border-line py-3"
                            >
                                <div
                                    className="h-11 w-11 flex-none rounded-lg bg-surface2 bg-cover bg-center"
                                    style={trade.coverImageUrl ? { backgroundImage: `url(${trade.coverImageUrl})` } : undefined}
                                />
                                <div className="min-w-0">
                                    <p className="truncate text-[13px] font-bold">{trade.title}</p>
                                    <p className="truncate text-[11.5px] text-faint">
                                        {trade.artistName ?? "아티스트 미상"}
                                        {" · "}
                                        {CONDITION_SHORT[trade.condition] ?? trade.condition}
                                    </p>
                                </div>
                                <div className="ml-auto flex-none text-right">
                                    <p className="font-mono text-[14.5px] font-bold tabular-nums text-up">
                                        {formatWon(trade.price)}
                                    </p>
                                    <p className="text-[11px] text-faint">{formatAgo(trade.tradedAt)}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            <StepsBand />
        </div>
    );
}

function SectionHead({
    eyebrow,
    eyebrowClass,
    title,
    link,
}: {
    eyebrow: string;
    eyebrowClass: string;
    title: string;
    link?: { to: string; label: string };
}) {
    return (
        <div className="mb-4 flex items-baseline justify-between">
            <div>
                <p className={`text-[11px] font-bold uppercase tracking-widest ${eyebrowClass}`}>{eyebrow}</p>
                <h2 className="mt-0.5 font-display text-2xl font-bold tracking-tight">{title}</h2>
            </div>
            {link && (
                <Link to={link.to} className="text-[13px] font-semibold text-muted hover:text-ink">
                    {link.label}
                </Link>
            )}
        </div>
    );
}

// 어두운 전폭 히어로 — 왼쪽은 카피, 오른쪽은 운영 카탈로그의 실제 커버 콜라주
function HeroBand() {
    return (
        <div className={`${FULL_BLEED} -mt-7 overflow-hidden bg-hero text-hero-cream`}>
            <div className="mx-auto grid min-h-[440px] max-w-[1180px] items-center gap-10 px-5 md:grid-cols-[minmax(360px,46%)_1fr]">
                <div className="relative z-10 py-12">
                    <p className="text-[11.5px] font-extrabold uppercase tracking-[0.22em] text-glow">
                        Rare Pressings, Fair Prices
                    </p>
                    <h1 className="mt-4 font-display text-[clamp(34px,4.6vw,54px)] font-bold leading-[1.22] tracking-tight text-balance break-keep">
                        희귀 LP,
                        <br />
                        <em className="not-italic text-glow">경매</em>로 만나고
                        <br />
                        시세로 확인하세요
                    </h1>
                    <p className="mt-5 max-w-[38ch] text-[15px] leading-relaxed text-hero-dim break-keep">
                        실제 낙찰 기록으로 시세를 확인하고, 원하는 판에 바로 입찰하세요.
                    </p>
                    <div className="mt-7 flex gap-2.5">
                        <Link
                            to="/catalog"
                            className="rounded-xl bg-hero-cream px-6 py-3 text-[14.5px] font-extrabold text-hero"
                        >
                            카탈로그 둘러보기
                        </Link>
                        <Link
                            to="/feed"
                            className="rounded-xl border border-hero-line px-5 py-3 text-[14.5px] font-bold text-hero-cream"
                        >
                            경매 피드 →
                        </Link>
                    </div>
                </div>
                <div className="relative hidden self-stretch md:block">
                    <div className="absolute -inset-y-5 -right-7 left-0 grid -rotate-2 -translate-y-2 grid-cols-5 gap-2.5">
                        {COLLAGE_COVERS.map((url) => (
                            <div
                                key={url}
                                className="aspect-square rounded-lg bg-cover bg-center opacity-90 shadow-[0_8px_22px_rgba(0,0,0,0.45)]"
                                style={{ backgroundImage: `url(${url})` }}
                            />
                        ))}
                    </div>
                    {/* 카피 쪽으로 갈수록 어두워지는 스크림 — 글자가 콜라주 위에서도 읽히게 */}
                    <div className="absolute inset-0 z-[1] bg-[linear-gradient(90deg,var(--color-hero)_0%,transparent_34%)]" />
                </div>
            </div>
        </div>
    );
}

function GenreTile({ value, label }: { value: string; label: string }) {
    const cover = GENRE_COVERS[value];
    return (
        <Link
            to={`/feed?genre=${encodeURIComponent(value)}`}
            className="group relative aspect-[8/5] overflow-hidden rounded-xl"
        >
            {cover ? (
                <div
                    className="absolute inset-0 bg-cover bg-[center_30%] transition-transform duration-300 group-hover:scale-105"
                    style={{ backgroundImage: `url(${cover})` }}
                />
            ) : (
                // 대표 커버가 없는 장르는 사이트의 생성 커버 패턴(그라데이션 + 바이닐 원)으로 폴백
                <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(135deg, ${value === "Reggae" ? "#7a4a2b" : "#2b3d52"}, #191a16 90%)` }}
                >
                    <div
                        className="absolute -right-[22%] top-1/2 aspect-square w-[75%] -translate-y-1/2 rounded-full shadow-[inset_0_0_0_2px_#33342c]"
                        style={{
                            background:
                                "radial-gradient(circle,#2a2b26 18%,#1c1d19 19% 30%,#26271f 31% 33%,#1c1d19 34% 45%,#26271f 46% 48%,#1c1d19 49% 62%,#26271f 63% 65%,#1c1d19 66%)",
                        }}
                    />
                </div>
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,20,16,0.05)_30%,rgba(20,20,16,0.72))]" />
            <span className="absolute bottom-2.5 left-3.5 z-[1] font-display text-lg font-bold text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
                {label}
            </span>
        </Link>
    );
}

// 절차 밴드 — 히어로와 같은 어두운 띠로 페이지를 닫는다. 푸터(어두움)와 한 덩어리로 보이게
// main의 pb-20을 음수 마진으로 상쇄한다
function StepsBand() {
    const steps = [
        { no: "01", title: "예치금 충전", desc: "포인트 지갑에 예치금을 충전하면 바로 입찰할 수 있습니다." },
        { no: "02", title: "입찰과 낙찰", desc: "마감 직전 입찰이 들어오면 판매자가 정한 시간만큼 연장되고, 최고가 입찰자가 낙찰받습니다." },
        { no: "03", title: "확정 후 정산", desc: "결제 금액은 구매 확정 후에 판매자에게 정산됩니다." },
    ];
    return (
        <div className={`${FULL_BLEED} -mb-20 mt-14 bg-hero text-hero-cream`}>
            <div className="mx-auto grid max-w-[1180px] items-start gap-6 px-5 py-11 md:grid-cols-[auto_1fr_1fr_1fr] md:gap-11">
                <h2 className="max-w-[10ch] font-display text-[22px] font-bold leading-snug break-keep">
                    경매는 이렇게 진행돼요
                </h2>
                {steps.map((step) => (
                    <div key={step.no}>
                        <p className="font-mono text-xs font-bold tracking-[0.14em] text-glow">{step.no}</p>
                        <p className="mt-2 text-[15px] font-bold">{step.title}</p>
                        <p className="mt-1.5 text-[12.5px] leading-relaxed text-hero-dim break-keep">{step.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
