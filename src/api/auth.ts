import { ApiError, apiDelete, apiPost } from "./client";
import { decodeMemberId, saveSession, type Session } from "../auth/session";

// 백엔드가 리프레시 토큰 기능을 넣으면서 응답이 accessToken 필드로 바뀌었다 (refreshToken은 httpOnly 쿠키로 옴)
interface LoginResult {
    accessToken: string;
}

// member-service(8081) 로그인 — vite proxy가 /api/v1/auth를 8081로 넘긴다
export async function login(email: string, password: string): Promise<Session> {
    const result = await apiPost<LoginResult>("/api/v1/auth/login", { email, password });
    const memberId = decodeMemberId(result.accessToken);
    if (memberId === null) {
        throw new ApiError("TOKEN_PARSE", "로그인 토큰을 해석하지 못했습니다.", 0);
    }
    const session: Session = {
        token: result.accessToken,
        memberId,
        displayName: email.split("@")[0],
    };
    saveSession(session);
    return session;
}

// DELETE /api/v1/auth/logout — 서버에 저장된 리프레시 토큰을 폐기하고 쿠키를 만료시킨다.
// 로컬 세션만 지우면 서버 쪽 토큰이 살아남아 보안 구멍이 된다
export function logoutServer(): Promise<void> {
    return apiDelete<void>("/api/v1/auth/logout");
}
