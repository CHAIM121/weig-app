import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/auth-server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.pathname.split("/")[1] === "en" ? "en" : "he";
  const code = url.searchParams.get("code");
  if (code) {
    const client = await createAuthServerClient();
    if (client) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(`/${locale}/places`, url.origin));
    }
  }
  return NextResponse.redirect(new URL(`/${locale}/auth?error=callback`, url.origin));
}
