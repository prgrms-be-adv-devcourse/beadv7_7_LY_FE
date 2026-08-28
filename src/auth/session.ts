// 로그인 세션 보관 — AT/RT 모두 httpOnly 쿠키로 오가므로 토큰 값 자체는 프론트가 들고 있지 않는다.
// 로그인 직후 /api/v1/members/me를 조회해 얻은 memberId/닉네임만 화면 표시·식별용으로 저장한다.
// (회원 식별은 게이트웨이가 accessToken 쿠키를 검증해 X-Member-Id 헤더로 서비스에 전달한다)

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "groove_session";

export interface Session {
    memberId: number;
    displayName: string;
}

// 세션이 바뀌면(로그인·로그아웃·갱신 실패로 삭제) 구독 중인 화면에 알린다 —
// localStorage만 지우면 렌더가 다시 돌지 않아 헤더 등이 로그인 상태로 남아 있었다
const listeners = new Set<() => void>();
// useSyncExternalStore는 값이 안 바뀌면 같은 참조를 돌려받아야 해서(매번 JSON 파싱하면
// 새 객체라 무한 리렌더) 파싱 결과를 캐시하고, 변경 알림 때만 무효화한다
let cached: Session | null = null;
let cacheValid = false;

function notifySessionChange(): void {
    cacheValid = false;
    listeners.forEach((listener) => listener());
}

// 다른 탭에서 로그인/로그아웃하면 storage 이벤트로 이 탭에도 전파된다 (key null은 전체 삭제)
window.addEventListener("storage", (e) => {
    if (e.key === null || e.key === STORAGE_KEY) notifySessionChange();
});

export function saveSession(session: Session): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    notifySessionChange();
}

export function loadSession(): Session | null {
    if (cacheValid) return cached;
    cacheValid = true;
    cached = null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Session;
        if (!Number.isFinite(parsed.memberId) || !parsed.displayName) return null;
        cached = parsed;
        return parsed;
    } catch {
        return null;
    }
}

export function clearSession(): void {
    localStorage.removeItem(STORAGE_KEY);
    notifySessionChange();
}

function subscribeSession(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

// 렌더에서 세션을 읽을 땐 이 훅을 쓴다 — loadSession() 직접 호출은 세션이 바뀌어도 화면이 모른다
export function useSession(): Session | null {
    return useSyncExternalStore(subscribeSession, loadSession);
}
