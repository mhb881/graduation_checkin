import { NextResponse } from "next/server";
import { db } from "@/db";
import { handleApiError, parseJsonBody } from "@/lib/api-utils";
import {
  getParticipantById,
  ServiceError,
  updateParticipant,
} from "@/lib/graduation-service";
import { generateQrDataUrl } from "@/lib/qr";
import { requireAdmin } from "@/lib/session";
import { updateParticipantSchema } from "@/lib/validators";

function parseId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ServiceError(400, "INVALID_ID", "无效的参与者 ID");
  }
  return id;
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request.headers);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const { id: rawId } = await ctx.params;
    const id = parseId(rawId);
    const participant = await getParticipantById(db, id);
    if (!participant) {
      throw new ServiceError(404, "PARTICIPANT_NOT_FOUND", "未找到该参与者");
    }
    const qrDataUrl = await generateQrDataUrl(participant.code);
    return NextResponse.json({ participant, qrDataUrl });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request.headers);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const { id: rawId } = await ctx.params;
    const id = parseId(rawId);
    const body = await parseJsonBody(request);
    const input = updateParticipantSchema.parse(body);
    const participant = await updateParticipant(db, id, input, authResult.actor);
    return NextResponse.json({ participant });
  } catch (err) {
    return handleApiError(err);
  }
}
