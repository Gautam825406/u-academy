import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Session-refresh middleware (standard Supabase SSR pattern): every
// /dashboard request validates the access token with getUser(), which
// refreshes it from the refresh-token cookie when it has expired, and the
// refreshed cookies are written back on the response — so a student stays
// logged in across refreshes, revisits and PWA launches until they log out
// or the refresh token itself is gone.
//
// Root cause of the old auto-logout (fixed here): getUser() also returns
// null on a TRANSIENT failure (network blip, refresh still in flight),
// and the old code redirected to /auth/login on ANY null — so one bad
// call logged the student out. Now we only redirect when there is NO
// Supabase auth cookie at all; if cookies exist but validation failed
// transiently, the request goes through and the dashboard's client-side
// restore (getSession + retry + onAuthStateChange) decides.
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !hasAuthCookie && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }
  return supabaseResponse;
}
export const config = { matcher: ["/dashboard/:path*"] };
