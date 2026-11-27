import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { handleApiError } from "@/lib/api-utils";
import { callNextParticipant, ServiceError } from "@/lib/graduation-service";
import { requireStaffOrAdmin } from "@/lib/session";

const callNextBodySchema = z
  .object({
    autoCompleteCurrent: z.boolean().optional().default(true),
    expectedCurrentId: z.number().int().positive().nullable().optional(),
    expectedNextId: z.number().int().positive().optional(),
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
    const rawText = await request.text();
    if (rawText.trim()) {
      try {
        rawBody = JSON.parse(rawText);
      } catch {
        throw new ServiceError(400, "INVALID_JSON", "请求体必须为合法的 JSON 格式");
      }
    }
    const body = callNextBodySchema.parse(rawBody);
    const result = await callNextParticipant(db, authResult.actor, {
      autoCompleteCurrent: body.autoCompleteCurrent,
      expectedCurrentId: body.expectedCurrentId,
      expectedNextId: body.expectedNextId,
    });

    return NextResponse.json({
      ...result,
      message: `请 ${result.currentOnStage.name}（${result.currentOnStage.code}）上台`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
