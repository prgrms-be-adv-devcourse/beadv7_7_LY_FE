import { clearSession, loadSession } from "../auth/session";

// 백엔드(게이트웨이) 주소. 비워두면 지금까지처럼 개발 서버의 중계 설정을 탄다.
// 값을 넣으면 브라우저가 그 주소로 직접 요청한다 — 이때 게이트웨이에 출처 허용 설정이 있어야 한다
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = "ApiError";
    }
}

interface ApiEnvelope<T> {
    success: boolean;
    data: T;
    error: { code: string; message: string } | null;
}

const RENEWAL_PATH = "/api/v1/auth/renewal";

// 액세스 토큰이 만료됐을 때 httpOnly 쿠키의 리프레시 토큰으로 새 토큰을 받아온다.
// 새 accessToken은 Set-Cookie로만 내려오므로(JSON 바디를 읽지 않음) 여기서는 성공 여부만 판단한다.
// 실패하면(리프레시 토큰도 만료 등) 세션을 지워 재로그인을 유도한다
async function tryRenewal(): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE_URL}${RENEWAL_PATH}`, { method: "POST", credentials: "include" });
        const body = (await res.json().catch(() => null)) as ApiEnvelope<null> | null;
        if (!res.ok || !body || !body.success) {
            // 리프레시 토큰이 진짜 거절된 때(401·403)만 세션을 지운다.
            // 일시적 서버 장애(5xx)나 게이트웨이 재시작 때문에 로그아웃시키지 않는다
            if (res.status === 401 || res.status === 403) {
                clearSession();
            }
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

async function request<T>(path: string, init?: RequestInit, retriedAfterRenewal = false): Promise<T> {
    let res: Response;
    try {
        res = await fetch(`${API_BASE_URL}${path}`, init);
    } catch {
        throw new ApiError("NETWORK", "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.", 0);
    }
    const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!res.ok || !body || !body.success) {
        // 액세스 토큰 만료(401)면 한 번만 재발급받고(쿠키 갱신) 원 요청을 재시도한다
        if (res.status === 401 && !retriedAfterRenewal && loadSession() !== null && (await tryRenewal())) {
            return request<T>(path, init, true);
        }
        throw new ApiError(
            body?.error?.code ?? "UNKNOWN",
            body?.error?.message ?? `요청이 실패했습니다 (HTTP ${res.status})`,
            res.status,
        );
    }
    return body.data;
}

// 인증이 필요한 API는 accessToken(httpOnly 쿠키)로 식별된다 — 게이트웨이가 쿠키를 검사해
// 회원 번호를 알아내고, 그 번호를 헤더에 담아 서비스로 넘긴다. 그래서 모든 요청에 쿠키가
// 실려야 하므로(교차 출처 배포에서도) credentials: "include"를 기본으로 둔다
export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
    return request<T>(path, { credentials: "include", signal });
}

export function apiPost<T>(path: string, payload?: unknown): Promise<T> {
    return request<T>(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        credentials: "include",
    });
}

export function apiPut<T>(path: string, payload?: unknown): Promise<T> {
    return request<T>(path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        credentials: "include",
    });
}

export function apiPatch<T>(path: string, payload?: unknown): Promise<T> {
    return request<T>(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        credentials: "include",
    });
}

export function apiDelete<T>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE", credentials: "include" });
}
