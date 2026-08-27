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
        <div className="min-h-screen">
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
                            <Link to="/signup" className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-ink">
                                회원가입
                            </Link>
                        </div>
                    )}
                </div>
            </header>
            <main className="mx-auto max-w-[1180px] px-5 pb-20 pt-7">
                <Outlet />
            </main>
            <SiteFooter loggedIn={session !== null} />
            <Toasts />
        </div>
    );
}

const FOOTER_BROWSE = [
    { to: "/feed", label: "경매 피드" },
    { to: "/catalog", label: "음반 카탈로그" },
    { to: "/auctions/new", label: "경매 등록" },
];

const FOOTER_MINE = [
    { to: "/mypage?tab=participated", label: "참여한 경매" },
    { to: "/mypage?tab=hosted", label: "등록한 경매" },
    { to: "/mypage?tab=orders", label: "주문 내역" },
    { to: "/mypage?tab=wallet", label: "예치금 지갑" },
];

const REPOSITORIES = [
    { href: "https://github.com/prgrms-be-adv-devcourse/beadv7_7_LY_BE", label: "백엔드 저장소" },
    { href: "https://github.com/prgrms-be-adv-devcourse/beadv7_7_LY_FE", label: "프론트엔드 저장소" },
];

function SiteFooter({ loggedIn }: { loggedIn: boolean }) {
    return (
        <footer className="border-t border-line bg-surface">
            <div className="mx-auto grid max-w-[1180px] gap-8 px-5 py-10 sm:grid-cols-2 md:grid-cols-4">
                <div className="sm:col-span-2 md:col-span-1">
                    <p className="flex items-center gap-2 font-display text-[15px] font-bold tracking-tight">
                        <span
                            aria-hidden="true"
                            className="block h-[18px] w-[18px] rounded-full shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
                        />
                        Groovid
                    </p>
                    <p className="mt-2 max-w-[34ch] text-[12.5px] leading-relaxed text-muted">
                        희귀 LP를 경매로 사고팔고, 실제 낙찰가로 시세를 확인하는 곳입니다.
                    </p>
                </div>
                <FooterColumn title="둘러보기">
                    {FOOTER_BROWSE.map((item) => (
                        <li key={item.to}>
                            <Link to={item.to} className="hover:text-ink">
                                {item.label}
                            </Link>
                        </li>
                    ))}
                </FooterColumn>
                <FooterColumn title="내 정보">
                    {/* 로그인해야 열리는 화면이라, 로그인 전에는 로그인으로 보내 헛걸음을 만들지 않는다 */}
                    {FOOTER_MINE.map((item) => (
                        <li key={item.to}>
                            <Link to={loggedIn ? item.to : "/login"} className="hover:text-ink">
                                {item.label}
                            </Link>
                        </li>
                    ))}
                </FooterColumn>
                <FooterColumn title="프로젝트">
                    {REPOSITORIES.map((repo) => (
                        <li key={repo.href}>
                            <a href={repo.href} target="_blank" rel="noreferrer" className="hover:text-ink">
                                {repo.label} ↗
                            </a>
                        </li>
                    ))}
                </FooterColumn>
            </div>
            <div className="border-t border-line">
                <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-2 px-5 py-4 text-[11.5px] text-faint">
                    <span>© 2026 Groovid</span>
                    <span>프로그래머스 데브코스 백엔드 과정 팀 프로젝트</span>
                </div>
            </div>
        </footer>
    );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-faint">{title}</p>
            <ul className="mt-2.5 flex flex-col gap-1.5 text-[12.5px] text-muted">{children}</ul>
        </div>
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
