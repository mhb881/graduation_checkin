import { NextResponse } from "next/server";
import { db } from "@/db";
import { handleApiError } from "@/lib/api-utils";
import { getParticipantById, ServiceError } from "@/lib/graduation-service";
import { buildQrPayload, generateQrDataUrl, generateQrSvg } from "@/lib/qr";
import { requireAdmin } from "@/lib/session";

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
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ServiceError(400, "INVALID_ID", "无效的参与者 ID");
    }

    const participant = await getParticipantById(db, id);
    if (!participant) {
      throw new ServiceError(404, "PARTICIPANT_NOT_FOUND", "未找到该参与者");
    }

    const url = new URL(request.url);
    const format = url.searchParams.get("format");
    if (format === "svg") {
      const svg = await generateQrSvg(participant.code);
      return new Response(svg, {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Content-Disposition": `inline; filename="${participant.code}.svg"`,
        },
      });
    }

    const qrDataUrl = await generateQrDataUrl(participant.code);
    return NextResponse.json({
      id: participant.id,
      code: participant.code,
      name: participant.name,
      email: participant.email,
      qrPayload: buildQrPayload(participant.code),
      qrDataUrl,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
