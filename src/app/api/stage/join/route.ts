import { NextResponse } from "next/server";
import { db } from "@/db";
import { handleApiError, parseJsonBody } from "@/lib/api-utils";
import { getStageSnapshot, joinStageQueue } from "@/lib/graduation-service";
import { requireStaffOrAdmin } from "@/lib/session";
import { scanInputSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const authResult = await requireStaffOrAdmin(request.headers);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const body = await parseJsonBody(request);
    const { raw, mode } = scanInputSchema.parse(body);
    const participant = await joinStageQueue(db, raw, mode, authResult.actor);
    const snapshot = await getStageSnapshot(db);
    return NextResponse.json({
      participant,
      snapshot,
      message: `${participant.name}（${participant.code}）已加入舞台等候队列`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
