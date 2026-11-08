import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { searchAll } from "@/lib/search/search";
import type { SearchResponse } from "@/lib/search/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const locale = searchParams.get("locale") === "ar" ? "ar" : "en";

  if (query.length === 0) {
    const response: SearchResponse = { groups: [] };
    return NextResponse.json(response);
  }

  if (query.length > 80) {
    return NextResponse.json(
      { error: "Search query is too long" },
      { status: 400 },
    );
  }

  try {
    const groups = await searchAll({ user, locale, query, limit: 5 });
    const response: SearchResponse = { groups };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Global search failed", error);
    return NextResponse.json(
      { error: "Search is unavailable right now" },
      { status: 500 },
    );
  }
}
