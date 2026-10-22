import { NextRequest } from "next/server";
import { GET as details } from "../details/route";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const url = new URL(request.url);
  url.searchParams.set("id", (await context.params).id);
  return details(new NextRequest(url, { headers: request.headers }));
}
