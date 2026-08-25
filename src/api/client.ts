import { clearSession, loadSession, saveSession } from "../auth/session";

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
// 실패하면(리프레시 토큰도 만료 등) 세션을 지워 재로그인을 유도한다
async function tryRenewal(): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE_URL}${RENEWAL_PATH}`, { method: "POST", credentials: "include" });
        const body = (await res.json().catch(() => null)) as ApiEnvelope<{ accessToken: string }> | null;
        if (!res.ok || !body || !body.success) {
            // 리프레시 토큰이 진짜 거절된 때(401·403)만 세션을 지운다.
            // 일시적 서버 장애(5xx)나 게이트웨이 재시작 때문에 로그아웃시키지 않는다
            if (res.status === 401 || res.status === 403) {
                clearSession();
            }
            return false;
        }
        const session = loadSession();
        if (session === null) return false;
        saveSession({ ...session, token: body.data.accessToken });
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
        // 액세스 토큰 만료(401)면 한 번만 재발급받고 원 요청을 새 토큰으로 재시도한다
        if (res.status === 401 && !retriedAfterRenewal && loadSession() !== null && (await tryRenewal())) {
            const retryInit: RequestInit = {
                ...init,
                headers: { ...(init?.headers as Record<string, string>), ...memberHeaders() },
            };
            return request<T>(path, retryInit, true);
        }
        throw new ApiError(
            body?.error?.code ?? "UNKNOWN",
            body?.error?.message ?? `요청이 실패했습니다 (HTTP ${res.status})`,
            res.status,
        );
    }
    return body.data;
}

// 회원 식별이 필요한 API용 헤더 — 로그인 토큰을 보낸다.
// 게이트웨이가 이 토큰을 검사해 회원 번호를 알아내고, 그 번호를 헤더에 담아 서비스로 넘긴다.
// 프론트가 회원 번호를 직접 만들어 보내던 방식은 번호만 바꿔 남의 계정으로 요청할 수 있어 없앴다
function memberHeaders(): Record<string, string> {
    const session = loadSession();
    return session ? { Authorization: `Bearer ${session.token}` } : {};
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
    return request<T>(path, { headers: memberHeaders(), signal });
}

// credentials: 리프레시 토큰 쿠키를 주고받는 인증 API(login·logout)만 "include"를 준다.
// 교차 출처 배포(프론트 vercel ↔ 백엔드 EC2)에서는 이게 없으면 응답의 Set-Cookie를
// 브라우저가 버려서, 쿠키가 저장되지 않아 토큰 갱신이 항상 실패한다
export function apiPost<T>(path: string, payload?: unknown, credentials?: RequestCredentials): Promise<T> {
    return request<T>(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...memberHeaders() },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        credentials,
    });
}

export function apiPut<T>(path: string, payload?: unknown): Promise<T> {
    return request<T>(path, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...memberHeaders() },
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
}

export function apiPatch<T>(path: string, payload?: unknown): Promise<T> {
    return request<T>(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...memberHeaders() },
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
}

export function apiDelete<T>(path: string, credentials?: RequestCredentials): Promise<T> {
    return request<T>(path, { method: "DELETE", headers: memberHeaders(), credentials });
}
