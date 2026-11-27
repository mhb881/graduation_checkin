import { NextResponse } from "next/server";
import { db } from "@/db";
import { handleApiError } from "@/lib/api-utils";
import { completeCurrentOnStage } from "@/lib/graduation-service";
import { requireStaffOrAdmin } from "@/lib/session";

export async function POST(request: Request) {
  const authResult = await requireStaffOrAdmin(request.headers);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const result = await completeCurrentOnStage(db, authResult.actor);
    return NextResponse.json({
      ...result,
      message: `${result.completedParticipant.name}（${result.completedParticipant.code}）已完成上台流程`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
