import type { JWK, SupabaseClient } from "@supabase/supabase-js";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/* ------------------------------------------------------------------
   JWT 서명 공개키(JWKS) 캐시

   supabase-js 의 JWKS 캐시는 "클라이언트 인스턴스" 단위인데, 서버에서는
   요청마다 새 클라이언트를 만들기 때문에 매번 공개키를 다시 받아오게 된다
   (요청당 왕복 1회 추가). 프로세스 단위로 캐시해 getClaims 에 직접 넘겨준다.
------------------------------------------------------------------ */

const JWKS_TTL_MS = 10 * 60 * 1000;
let jwksCache: { keys: JWK[]; at: number } | null = null;
let jwksInFlight: Promise<JWK[]> | null = null;

async function loadJwks(): Promise<JWK[]> {
  const now = Date.now();
  if (jwksCache && now - jwksCache.at < JWKS_TTL_MS) return jwksCache.keys;
  if (jwksInFlight) return jwksInFlight;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return [];

  jwksInFlight = (async () => {
    try {
      const res = await fetch(`${base}/auth/v1/.well-known/jwks.json`, {
        // 여러 요청이 동시에 들어와도 Next 가 한 번만 실제로 가져오도록
        next: { revalidate: 600 },
      });
      const data = (await res.json()) as { keys?: JWK[] };
      jwksCache = { keys: data.keys ?? [], at: Date.now() };
      return jwksCache.keys;
    } catch {
      // 실패하면 supabase-js 가 알아서 받아오도록 빈 배열을 넘긴다
      return [];
    } finally {
      jwksInFlight = null;
    }
  })();

  return jwksInFlight;
}

/** JWT 클레임을 로컬에서 검증해 읽는다 (Auth 서버 왕복 없음) */
export async function getVerifiedClaims(supabase: SupabaseClient) {
  const keys = await loadJwks();
  const { data } = await supabase.auth.getClaims(
    undefined,
    keys.length > 0 ? { keys } : undefined
  );
  return data?.claims ?? null;
}

/**
 * 로그인 사용자 정보.
 *
 * getUser() 는 호출할 때마다 Auth 서버로 왕복하지만, getClaims() 는 JWT 를
 * 로컬에서 검증한다(이 프로젝트는 ES256 비대칭 키). 만료된 토큰은 내부의
 * getSession() 이 갱신하므로 동작은 같다.
 *
 * 표시 이름도 JWT 의 user_metadata 에 들어 있어 profiles 조회가 필요 없다.
 */
export async function getSessionUser(
  supabase: SupabaseClient
): Promise<SessionUser | null> {
  const claims = await getVerifiedClaims(supabase);
  if (!claims?.sub) return null;

  const meta = (claims.user_metadata ?? {}) as { name?: string };
  const email = typeof claims.email === "string" ? claims.email : "";
  return {
    id: claims.sub,
    email,
    name: meta.name?.trim() || email.split("@")[0] || "",
  };
}
