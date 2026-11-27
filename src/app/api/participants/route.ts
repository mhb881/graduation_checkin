import { NextResponse } from "next/server";
import { db } from "@/db";
import { handleApiError, parseJsonBody } from "@/lib/api-utils";
import {
  createParticipant,
  getDashboardStats,
  listParticipants,
} from "@/lib/graduation-service";
import { requireAdmin } from "@/lib/session";
import {
  createParticipantSchema,
  participantListQuerySchema,
} from "@/lib/validators";

export async function GET(request: Request) {
  const authResult = await requireAdmin(request.headers);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const url = new URL(request.url);
    const parsedQuery = participantListQuerySchema.parse({
      q: url.searchParams.get("q") ?? undefined,
      checkInStatus: url.searchParams.get("checkInStatus") ?? undefined,
      stageStatus: url.searchParams.get("stageStatus") ?? undefined,
    });

    const [items, stats] = await Promise.all([
      listParticipants(db, parsedQuery),
      getDashboardStats(db),
    ]);

    return NextResponse.json({ participants: items, stats });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  const authResult = await requireAdmin(request.headers);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const body = await parseJsonBody(request);
    const input = createParticipantSchema.parse(body);
    const created = await createParticipant(db, input, authResult.actor);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
