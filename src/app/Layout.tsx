import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile } from "../api/members";
import { logoutServer } from "../api/auth";
import { clearSession, useSession } from "../auth/session";
import { Toasts } from "../components/Toasts";

const TABS = [
    { to: "/", label: "홈" },
    { to: "/feed", label: "경매 피드" },
    { to: "/catalog", label: "카탈로그" },
];

export function Layout() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    // 세션 변경(로그인·로그아웃·갱신 실패로 삭제)을 구독해서, 세션이 지워지면 헤더도 즉시 바뀐다
    const session = useSession();
    const location = useLocation();

    // 로그인 응답에는 토큰만 들어 있어서 세션 이름은 이메일 앞부분(test123@... → test123)이다.
    // 헤더에는 회원 정보의 닉네임을 쓰되, 아직 못 받았거나 조회가 실패하면 세션 이름으로 대신한다.
    // 마이페이지 프로필과 같은 키를 써서 요청이 두 번 나가지 않는다
    const profile = useQuery({ queryKey: ["member", "me"], queryFn: getMyProfile, enabled: session !== null });
    const user = session === null ? null : (profile.data?.nickname ?? session.displayName);

    function logout() {
        // 서버의 리프레시 토큰도 폐기한다 — 실패해도 로컬 세션 정리는 진행
        logoutServer().catch(() => {});
        clearSession();
        // 주문·정산·지갑은 모두 로그인한 사람 기준이라, 캐시를 비우지 않으면
        // 다른 계정으로 다시 로그인했을 때 이전 사람의 내역이 잠깐 보인다
        queryClient.clear();
        navigate("/");
    }

    return (
        // 세로 방향 flex로 두고 본문이 남은 높이를 차지하게 한다 — 로그인처럼 내용이 짧은 화면에서
        // 푸터가 화면 중간에 뜨고 그 아래가 빈 배경으로 남는 것을 막는다
        <div className="flex min-h-screen flex-col overflow-x-clip">
            <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
                <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-3 px-5 py-3 sm:gap-4">
                    <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
                        <span
                            aria-hidden="true"
                            className="block h-[22px] w-[22px] rounded-full shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
                            style={{
                                background:
                                    "radial-gradient(circle, var(--color-paper) 0 14%, var(--color-ink) 15% 17%, var(--color-ink) 18% 100%)",
                            }}
                        />
                        <b className="text-base">Groovid</b>
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-faint">LP Auction</span>
                    </Link>
                    <nav className="flex gap-0.5" aria-label="주요 화면">
                        {TABS.map((tab) => (
                            <NavLink
                                key={tab.to}
                                to={tab.to}
                                end={tab.to === "/"}
                                className={({ isActive }) =>
                                    `rounded-lg px-3 py-1.5 text-[13.5px] font-semibold transition-colors ${
                                        isActive ? "bg-ink text-paper" : "text-muted hover:bg-surface2 hover:text-ink"
                                    }`
                                }
                            >
                                {tab.label}
                            </NavLink>
                        ))}
                    </nav>
                    <div className="grow" />
                    <HeaderSearch />
                    {/* 좁은 화면에선 검색창이 숨으므로 아이콘으로 카탈로그(검색 화면) 진입을 보장한다 */}
                    <Link
                        to="/catalog"
                        aria-label="카탈로그 검색"
                        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-muted hover:border-line-strong hover:text-ink md:hidden"
                    >
                        ⌕
                    </Link>
                    {user ? (
                        <div className="flex items-center gap-2 text-sm">
                            <Link
                                to="/auctions/new"
                                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13.5px] font-semibold hover:border-line-strong"
                            >
                                경매 등록
                            </Link>
                            <NavLink
                                to="/mypage"
                                className={({ isActive }) =>
                                    `rounded-lg px-3 py-1.5 text-[13.5px] font-semibold transition-colors ${
                                        isActive ? "bg-ink text-paper" : "text-muted hover:bg-surface2 hover:text-ink"
                                    }`
                                }
                            >
                                마이페이지
                            </NavLink>
                            <span className="font-semibold">{user}</span>
                            <button type="button" onClick={logout} className="text-xs text-muted underline hover:text-ink">
                                로그아웃
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Link
                                to="/login"
                                state={{ from: location.pathname + location.search }}
                                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold hover:border-line-strong"
                            >
                                로그인
                            </Link>
                            <Link to="/signup" className="rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-paper hover:opacity-90">
                                회원가입
                            </Link>
                        </div>
                    )}
                </div>
            </header>
            <main className="mx-auto w-full max-w-[1180px] grow px-5 pb-20 pt-7">
                <Outlet />
            </main>
            <SiteFooter loggedIn={session !== null} />
            <Toasts />
        </div>
    );
}

function SiteFooter({ loggedIn }: { loggedIn: boolean }) {
    return (
        <footer className="border-t border-hero-line bg-hero">
            <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-x-10 gap-y-2.5 px-5 py-6">
                <div className="flex items-center gap-2.5">
                    <span
                        aria-hidden="true"
                        className="block h-[16px] w-[16px] rounded-full shadow-[inset_0_0_0_1px_var(--color-hero-line)]"
                    />
                    <span className="font-display text-[14px] font-bold tracking-tight text-hero-cream">Groovid</span>
                    <span className="text-[12.5px] text-hero-dim">희귀 LP를 경매로 사고파는 곳</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] text-hero-dim">
                    <Link to="/feed" className="hover:text-hero-cream">
                        경매 피드
                    </Link>
                    <Link to="/catalog" className="hover:text-hero-cream">
                        음반 카탈로그
                    </Link>
                    {/* 로그인해야 열리는 화면이라, 로그인 전에는 로그인으로 보내 헛걸음을 막는다 */}
                    <Link to={loggedIn ? "/mypage" : "/login"} className="hover:text-hero-cream">
                        마이페이지
                    </Link>
                    <span className="text-hero-dim/70">© 2026 Groovid</span>
                </div>
            </div>
        </footer>
    );
}

// 홈 히어로가 검색창에서 피처드 경매로 바뀌면서, 검색 진입은 헤더에 상시 고정한다.
// 1글자 검색은 카탈로그 화면이 안내 문구로 받아준다
function HeaderSearch() {
    const navigate = useNavigate();
    const [keyword, setKeyword] = useState("");

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const next = keyword.trim();
        if (!next) return;
        navigate(`/catalog?q=${encodeURIComponent(next)}`);
        setKeyword("");
    }

    return (
        <form onSubmit={submit} className="hidden md:block">
            <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="⌕ 앨범, 아티스트 검색"
                aria-label="카탈로그 검색"
                className="w-52 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] outline-none placeholder:text-faint focus:border-brand"
            />
        </form>
    );
}
