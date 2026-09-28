import { NextRequest, NextResponse } from "next/server";

import { defaultLocale } from "@/i18n/routing";
import { isLocale } from "@/i18n/dictionaries";

export function middleware(request: NextRequest) {
  const segments = request.nextUrl.pathname.split("/");
  const candidate = segments[1];

  if (!isLocale(candidate)) {
    const url = request.nextUrl.clone();
    const lastPath = request.cookies.get("weig-last-path")?.value;
    url.pathname = request.nextUrl.pathname === "/"
      ? (/^\/(he|en)\/(places|expenses|calls|ai)$/.test(lastPath ?? "") ? lastPath! : `/${defaultLocale}/places`)
      : `/${defaultLocale}${request.nextUrl.pathname}`;
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-weig-locale", candidate);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api/|privacy|terms|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
