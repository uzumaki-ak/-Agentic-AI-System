// this file exposes the api endpoint for the master agent
import { runMasterAgent } from "@/lib/agents/master-agent";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// this function handles query execution and returns structured output
export async function POST(request: Request): Promise<Response> {
  let payload: { query?: unknown } = {};
  try {
    payload = (await request.json()) as { query?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json payload" }, { status: 400 });
  }

  const query = typeof payload.query === "string" ? payload.query.trim() : "";
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  try {
    const result = await runMasterAgent(query);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
