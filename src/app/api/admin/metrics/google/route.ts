import { NextResponse } from "next/server";
import { authorize } from "@/modules/kashrut-admin/authorize";
import { placesDatabase } from "@/modules/places/server/database";
export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await authorize();
  if (auth.error) return auth.error;
  try {
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const days = await placesDatabase(`google_call_daily?day=gte.${since}&order=day.desc,sku.asc`, undefined, true);
    if (!days) throw new Error("NOT_CONFIGURED");
    return NextResponse.json({ days, timezone: "UTC" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "METRICS_UNAVAILABLE" }, { status: 503 });
  }
}
