import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
// Keep stored places and their linked information; disable imported discovery.
export async function GET() {
  return NextResponse.json({ error: "CATALOG_DISABLED" }, {
    status: 410, headers: { "Cache-Control": "no-store" },
  });
}
