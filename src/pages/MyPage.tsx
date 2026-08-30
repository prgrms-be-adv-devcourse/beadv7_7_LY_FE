import { Link, useLocation, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "../api/members";
import { useSession } from "../auth/session";
import { OverviewTab } from "./mypage/OverviewTab";
import { OrdersTab } from "./mypage/OrdersTab";
import { SettlementsTab } from "./mypage/SettlementsTab";
import { WalletTab } from "./mypage/WalletTab";
import { LikedProductsTab } from "./mypage/LikedProductsTab";
import { WatchedAuctionsTab } from "./mypage/WatchedAuctionsTab";
import { HostedAuctionsTab } from "./mypage/HostedAuctionsTab";
import { ParticipatedAuctionsTab } from "./mypage/ParticipatedAuctionsTab";

// 사이드바 메뉴. 성격이 다른 항목을 한 줄에 섞지 않는다 — 경매 활동과 돈이 오가는 거래로 2그룹
const MENU_GROUPS = [
    {
        label: null,
        tabs: [{ value: "overview", label: "개요" }],
    },
    {
        label: "경매 활동",
        tabs: [
            { value: "participated", label: "참여한 경매" },
            { value: "hosted", label: "등록한 경매" },
            { value: "liked", label: "찜한 상품" },
            { value: "watched", label: "관심 경매" },
        ],
    },
    {
        label: "거래",
        tabs: [
            { value: "orders", label: "주문" },
            { value: "settlements", label: "정산" },
            { value: "wallet", label: "지갑" },
        ],
    },
] as const;

export type TabValue = (typeof MENU_GROUPS)[number]["tabs"][number]["value"];

const ALL_TAB_VALUES: readonly string[] = MENU_GROUPS.flatMap((group) => group.tabs.map((t) => t.value));

const TAB_TITLES: Record<TabValue, string> = {
    overview: "개요",
    participated: "참여한 경매",
    hosted: "등록한 경매",
    liked: "찜한 상품",
    watched: "관심 경매",
    orders: "주문",
    settlements: "정산",
    wallet: "지갑",
};

export function MyPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const session = useSession();
    const tabParam = searchParams.get("tab");
    const tab: TabValue = ALL_TAB_VALUES.includes(tabParam ?? "") ? (tabParam as TabValue) : "overview";

    function selectTab(next: TabValue) {
        setSearchParams({ tab: next }, { replace: true });
    }

    if (!session) {
        return (
            <div className="rounded-xl border border-line bg-surface px-5 py-14 text-center">
                <p className="font-semibold">로그인이 필요한 화면입니다.</p>
                <p className="mt-1 text-sm text-muted">주문·정산·지갑 내역은 본인 계정으로만 볼 수 있습니다.</p>
                <Link
                    to="/login"
                    state={{ from: location.pathname + location.search }}
                    className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-ink"
                >
                    로그인하러 가기
                </Link>
            </div>
        );
    }

    return (
        <div className="grid items-start gap-8 md:grid-cols-[210px_1fr]">
            <Sidebar tab={tab} onSelect={selectTab} fallbackName={session.displayName} />
            <main className="min-w-0">
                <h1 className="mb-5 font-display text-2xl font-bold tracking-tight">{TAB_TITLES[tab]}</h1>
                {tab === "overview" && <OverviewTab onSelect={selectTab} />}
                {tab === "orders" && <OrdersTab />}
                {tab === "settlements" && <SettlementsTab />}
                {tab === "wallet" && <WalletTab />}
                {tab === "liked" && <LikedProductsTab />}
                {tab === "watched" && <WatchedAuctionsTab />}
                {tab === "hosted" && <HostedAuctionsTab />}
                {tab === "participated" && <ParticipatedAuctionsTab />}
            </main>
        </div>
    );
}

function Sidebar({
    tab,
    onSelect,
    fallbackName,
}: {
    tab: TabValue;
    onSelect: (tab: TabValue) => void;
    fallbackName: string;
}) {
    // 프로필 조회가 실패해도 탭은 쓸 수 있어야 하므로 로그인 세션의 이름으로 대체한다
    const profile = useQuery({ queryKey: ["member", "me"], queryFn: getMyProfile });
    const name = profile.data?.nickname ?? fallbackName;

    return (
        <aside>
            <div className="border-b border-line pb-4 max-md:flex max-md:items-center max-md:gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-brand text-[19px] font-extrabold text-white">
                    {name ? name[0] : "?"}
                </div>
                <div className="md:mt-2.5">
                    <p className="text-[15.5px] font-extrabold">{name}</p>
                    {profile.data && <p className="text-[12px] text-faint">{profile.data.email}</p>}
                </div>
            </div>
            {/* 모바일에서는 사이드바가 위로 접히므로 메뉴를 가로 칩 줄로 편다 */}
            <nav aria-label="마이페이지 메뉴" className="mt-3 max-md:flex max-md:flex-wrap max-md:gap-1.5">
                {MENU_GROUPS.map((group) => (
                    <div key={group.label ?? "root"} className="max-md:contents">
                        {group.label && (
                            <p className="mb-1 mt-4 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-faint max-md:hidden">
                                {group.label}
                            </p>
                        )}
                        {group.tabs.map((t) => (
                            <button
                                key={t.value}
                                type="button"
                                aria-current={tab === t.value ? "page" : undefined}
                                onClick={() => onSelect(t.value)}
                                className={`block w-full rounded-lg px-3 py-2 text-left text-[13.5px] transition-colors max-md:w-auto max-md:rounded-full max-md:border max-md:px-3 max-md:py-1.5 ${
                                    tab === t.value
                                        ? "bg-brand/10 font-extrabold text-brand-ink max-md:border-brand/30"
                                        : "font-semibold text-muted hover:bg-surface2 hover:text-ink max-md:border-line"
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                ))}
            </nav>
        </aside>
    );
}
