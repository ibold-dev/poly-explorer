import { NextResponse } from "next/server";
import { PolymarketClient } from "polymarket-client-ts";

const client = new PolymarketClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const user = searchParams.get("user");
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = parseInt(searchParams.get("limit") ?? "5000", 10);

  if (!user) {
    return NextResponse.json(
      { error: "Missing required parameter: user" },
      { status: 400 }
    );
  }

  const clampedLimit = Math.min(Math.max(limit, 1), 10000);
  const clampedOffset = Math.min(Math.max(offset, 0), 10000);

  try {
    const trades = await client.trades.getTrades({
      user,
      limit: clampedLimit,
      offset: clampedOffset,
      takerOnly: true,
    });

    return NextResponse.json({ trades, offset: clampedOffset, limit: clampedLimit });
  } catch (error) {
    console.error("Trades API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trades" },
      { status: 500 }
    );
  }
}
