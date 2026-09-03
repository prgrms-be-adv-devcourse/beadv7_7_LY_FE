import { apiDelete, apiPost } from "./client";
import { getMyProfile } from "./members";
import { saveSession, type Session } from "../auth/session";

// member-service(8081) 로그인 — vite proxy가 /api/v1/auth를 8081로 넘긴다.
// accessToken/refreshToken 모두 httpOnly 쿠키로 내려오므로(Set-Cookie) 응답 바디는 읽지 않는다.
// 화면 표시·식별에 쓰는 memberId/닉네임은 로그인 직후 /me를 조회해 얻는다.
// keepLoggedIn: false(공용 PC 로그인)면 만료일 없는 세션 쿠키로, true면 만료일이 지정된 쿠키로 내려준다
export async function login(email: string, password: string, keepLoggedIn: boolean): Promise<Session> {
    await apiPost<null>("/api/v1/auth/login", { email, password, keepLoggedIn });
    const profile = await getMyProfile();
    const session: Session = {
        memberId: profile.id,
        displayName: profile.nickname,
    };
    saveSession(session);
    return session;
}

// DELETE /api/v1/auth/logout — 서버에 저장된 리프레시 토큰을 폐기하고 쿠키를 만료시킨다.
// 로컬 세션만 지우면 서버 쪽 토큰이 살아남아 보안 구멍이 된다
export function logoutServer(): Promise<void> {
    return apiDelete<void>("/api/v1/auth/logout");
}
