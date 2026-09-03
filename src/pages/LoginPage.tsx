import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { login } from "../api/auth";
import { ApiError } from "../api/client";

export function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as { signedUp?: boolean; from?: string } | null;
    const signedUp = Boolean(state?.signedUp);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function submit(keepLoggedIn: boolean) {
        if (!email.trim() || !password.trim()) {
            setError("이메일과 비밀번호를 모두 입력하세요.");
            return;
        }
        setPending(true);
        setError(null);
        try {
            await login(email.trim(), password, keepLoggedIn);
            // 찜·관심 등록하려다 온 경우 보던 자리로 되돌려보낸다 (토스트의 로그인 버튼이 from을 실어 보냄)
            navigate(state?.from ?? "/", { replace: true });
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "로그인 처리 중 문제가 생겼습니다.");
        } finally {
            setPending(false);
        }
    }

    return (
        <div className="mx-auto max-w-sm">
            <div className="rounded-2xl border border-line bg-surface p-7 shadow-sm">
                <h1 className="font-display text-2xl font-semibold tracking-tight">로그인</h1>
                <p className="mt-1 text-[13px] text-muted">가입할 때 쓴 이메일로 로그인하세요.</p>
                {signedUp && (
                    <p className="mt-3 rounded-lg bg-up/10 px-3 py-2 text-[13px] font-semibold text-up">
                        가입이 완료됐습니다. 로그인해주세요.
                    </p>
                )}
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void submit(true);
                    }}
                    className="mt-5 flex flex-col gap-3"
                >
                    <label className="text-[13px] font-semibold">
                        이메일
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-brand"
                        />
                    </label>
                    <label className="text-[13px] font-semibold">
                        비밀번호
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-brand"
                        />
                    </label>
                    {error && <p className="text-[13px] font-semibold text-live">{error}</p>}
                    <button
                        type="submit"
                        disabled={pending}
                        className="mt-2 rounded-xl bg-brand py-3 text-sm font-bold text-white transition-colors hover:bg-brand-ink disabled:opacity-60"
                    >
                        {pending ? "로그인 중…" : "로그인"}
                    </button>
                    <button
                        type="button"
                        disabled={pending}
                        onClick={() => void submit(false)}
                        className="rounded-xl border border-line py-3 text-sm font-bold text-ink transition-colors hover:bg-paper disabled:opacity-60"
                    >
                        공용 PC 로그인
                    </button>
                    <p className="text-center text-[12px] text-muted">
                        공용 PC로 로그인하면 브라우저를 닫을 때 로그인이 해제됩니다.
                    </p>
                </form>
                <p className="mt-4 text-center text-[13px] text-muted">
                    계정이 없나요?{" "}
                    <Link to="/signup" className="font-semibold text-brand hover:underline">
                        회원가입
                    </Link>
                </p>
            </div>
        </div>
    );
}
