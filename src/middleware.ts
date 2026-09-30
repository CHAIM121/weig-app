import { NextRequest, NextResponse } from "next/server";
import { defaultLocale } from "@/i18n/routing";
import { isLocale } from "@/i18n/dictionaries";
import { createServerClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  const candidate = request.nextUrl.pathname.split("/")[1];
  if (!isLocale(candidate)) {
    const url = request.nextUrl.clone();
    url.pathname = request.nextUrl.pathname === "/" ? `/${defaultLocale}` : `/${defaultLocale}${request.nextUrl.pathname}`;
    return NextResponse.redirect(url);
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-weig-locale", candidate);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const authConfig = getPublicSupabaseConfig();
  if (authConfig && request.cookies.getAll().some(cookie => cookie.name.startsWith("sb-"))) {
    const client = createServerClient(authConfig.url, authConfig.anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (updates) => {
          updates.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          updates.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    await client.auth.getClaims();
  }
  return response;
}

export const config = {
  matcher: ["/((?!api/|privacy|terms|robots.txt|sitemap.xml|manifest.webmanifest|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
