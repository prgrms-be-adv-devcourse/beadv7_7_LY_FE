import { Link, useLocation, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "../api/members";
import { useSession } from "../auth/session";
import { MySummary } from "./mypage/MySummary";
import { OrdersTab } from "./mypage/OrdersTab";
import { SettlementsTab } from "./mypage/SettlementsTab";
import { WalletTab } from "./mypage/WalletTab";
import { LikedProductsTab } from "./mypage/LikedProductsTab";
import { WatchedAuctionsTab } from "./mypage/WatchedAuctionsTab";
import { HostedAuctionsTab } from "./mypage/HostedAuctionsTab";
import { ParticipatedAuctionsTab } from "./mypage/ParticipatedAuctionsTab";

// 성격이 다른 탭을 한 줄에 섞지 않는다 — 경매 활동과 돈이 오가는 거래로 2그룹
const TAB_GROUPS = [
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

export type TabValue = (typeof TAB_GROUPS)[number]["tabs"][number]["value"];

const ALL_TAB_VALUES: readonly string[] = TAB_GROUPS.flatMap((group) => group.tabs.map((t) => t.value));

export function MyPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const session = useSession();
    const tabParam = searchParams.get("tab");
    const tab: TabValue = ALL_TAB_VALUES.includes(tabParam ?? "") ? (tabParam as TabValue) : "participated";

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
        <div>
            <ProfileLine fallbackName={session.displayName} />
            <MySummary onSelect={selectTab} />
            {/* 스크롤은 래퍼가 담당 — nav에 직접 걸면 탭 밑줄의 1px 겹침(-mb-px)이 세로 스크롤바를 만든다 */}
            <div className="mb-5 mt-5 overflow-x-auto">
                <nav
                    className="flex w-max min-w-full gap-7 border-b border-line"
                    aria-label="마이페이지 탭"
                >
                    {TAB_GROUPS.map((group, index) => (
                        <div key={group.label} className={index > 0 ? "border-l border-line pl-7" : ""}>
                            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                                {group.label}
                            </p>
                            <div className="flex">
                                {group.tabs.map((t) => (
                                    <button
                                        key={t.value}
                                        type="button"
                                        aria-current={tab === t.value ? "page" : undefined}
                                        onClick={() => selectTab(t.value)}
                                        className={`-mb-px whitespace-nowrap border-b-2 px-3 pb-3 pt-1 text-[13.5px] font-semibold transition-colors ${
                                            tab === t.value
                                                ? "border-brand text-ink"
                                                : "border-transparent text-muted hover:text-ink"
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>
            </div>
            {tab === "orders" && <OrdersTab />}
            {tab === "settlements" && <SettlementsTab />}
            {tab === "wallet" && <WalletTab />}
            {tab === "liked" && <LikedProductsTab />}
            {tab === "watched" && <WatchedAuctionsTab />}
            {tab === "hosted" && <HostedAuctionsTab />}
            {tab === "participated" && <ParticipatedAuctionsTab />}
        </div>
    );
}

function ProfileLine({ fallbackName }: { fallbackName: string }) {
    // 프로필 조회가 실패해도 탭은 쓸 수 있어야 하므로 로그인 세션의 이름으로 대체한다
    const profile = useQuery({ queryKey: ["member", "me"], queryFn: getMyProfile });

    return (
        <div className="mb-4 flex items-baseline gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">My</p>
            <h2 className="text-lg font-bold tracking-tight">{profile.data?.nickname ?? fallbackName}</h2>
            {profile.data?.email && <p className="truncate text-[12.5px] text-muted">{profile.data.email}</p>}
        </div>
    );
}
