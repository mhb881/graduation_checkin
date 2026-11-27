import { NextResponse } from "next/server";
import { db } from "@/db";
import { handleApiError } from "@/lib/api-utils";
import { getPublicDisplayState, getStageSnapshot } from "@/lib/graduation-service";
import { getServerSessionActor } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");

    if (scope === "public") {
      const publicState = await getPublicDisplayState(db);
      return NextResponse.json(publicState);
    }

    const actor = await getServerSessionActor(request.headers);
    if (!actor) {
      const publicState = await getPublicDisplayState(db);
      return NextResponse.json(publicState);
    }

    const snapshot = await getStageSnapshot(db);
    return NextResponse.json(snapshot);
  } catch (err) {
    return handleApiError(err);
  }
}
