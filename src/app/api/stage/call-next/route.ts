import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { handleApiError } from "@/lib/api-utils";
import { callNextParticipant } from "@/lib/graduation-service";
import { requireStaffOrAdmin } from "@/lib/session";

const callNextBodySchema = z
  .object({
    autoCompleteCurrent: z.boolean().optional().default(true),
  })
  .optional()
  .default({ autoCompleteCurrent: true });

export async function POST(request: Request) {
  const authResult = await requireStaffOrAdmin(request.headers);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    let rawBody: unknown = undefined;
    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) > 0) {
      rawBody = await request.json();
    }
    const body = callNextBodySchema.parse(rawBody);
    const result = await callNextParticipant(db, authResult.actor, {
      autoCompleteCurrent: body.autoCompleteCurrent,
    });

    return NextResponse.json({
      ...result,
      message: `请 ${result.currentOnStage.name}（${result.currentOnStage.code}）上台`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
