import { NextResponse } from "next/server";
import { getStagingHealth } from "@/lib/staging-health";
export const dynamic = "force-dynamic";
export async function GET() {
  const result = await getStagingHealth();
  return NextResponse.json(result, {
    status: result.status === "alive" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
