import { NextResponse } from "next/server";
import { db } from "@/db";
import { handleApiError, parseJsonBody } from "@/lib/api-utils";
import { checkInParticipant } from "@/lib/graduation-service";
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
    const participant = await checkInParticipant(db, raw, mode, authResult.actor);
    return NextResponse.json({
      participant,
      message: `${participant.name}（${participant.code}）签到成功`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
