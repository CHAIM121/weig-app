import { NextRequest, NextResponse } from "next/server";
import { defaultLocale } from "@/i18n/routing";
import { isLocale } from "@/i18n/dictionaries";

export function middleware(request: NextRequest) {
  const candidate = request.nextUrl.pathname.split("/")[1];
  if (!isLocale(candidate)) {
    const url = request.nextUrl.clone();
    url.pathname = request.nextUrl.pathname === "/" ? `/${defaultLocale}` : `/${defaultLocale}${request.nextUrl.pathname}`;
    return NextResponse.redirect(url);
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-weig-locale", candidate);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api/|privacy|terms|robots.txt|sitemap.xml|manifest.webmanifest|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
