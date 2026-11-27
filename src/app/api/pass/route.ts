import { and, eq, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { participants } from "@/db/schema";
import { handleApiError, parseJsonBody } from "@/lib/api-utils";
import { buildQrPayload, generateQrDataUrl } from "@/lib/qr";

const passLookupSchema = z
  .object({
    identifier: z.string().trim().min(1).max(120).optional(),
    code: z.string().trim().min(1).max(32).optional(),
    email: z
      .string()
      .trim()
      .email("请输入登记时使用的有效邮箱")
      .transform((v) => v.toLowerCase()),
  })
  .refine((v) => Boolean(v.identifier || v.code), {
    message: "请输入姓名或唯一编号",
  });

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request);
    const parsed = passLookupSchema.parse(body);
    const rawIdentifier = (parsed.identifier ?? parsed.code ?? "").trim();
    const normalizedCode = rawIdentifier.toUpperCase();

    const rows = await db
      .select({
        id: participants.id,
        code: participants.code,
        name: participants.name,
        email: participants.email,
        checkedInAt: participants.checkedInAt,
        stageStatus: participants.stageStatus,
        queuedAt: participants.queuedAt,
        calledAt: participants.calledAt,
        completedAt: participants.completedAt,
      })
      .from(participants)
      .where(
        and(
          eq(participants.email, parsed.email),
          or(
            eq(participants.code, normalizedCode),
            eq(participants.name, rawIdentifier)
          )
        )
      )
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "PASS_NOT_FOUND",
          message: "信息不匹配，请核对姓名/编号与登记邮箱后重试，或联系现场服务台",
        },
        { status: 404 }
      );
    }

    const p = rows[0];
    let queuePosition: number | null = null;

    if (p.stageStatus === "WAITING" && p.queuedAt) {
      const [posRow] = await db
        .select({
          position: sql<number>`count(*)::int`,
        })
        .from(participants)
        .where(
          and(
            eq(participants.stageStatus, "WAITING"),
            sql`(${participants.queuedAt} < ${p.queuedAt} OR (${participants.queuedAt} = ${p.queuedAt} AND ${participants.id} <= ${p.id}))`
          )
        );
      queuePosition = Number(posRow?.position ?? 1);
    }

    const qrDataUrl = await generateQrDataUrl(p.code);

    return NextResponse.json({
      participant: {
        code: p.code,
        name: p.name,
        email: p.email,
        checkedInAt: p.checkedInAt ? p.checkedInAt.toISOString() : null,
        stageStatus: p.stageStatus,
        queuedAt: p.queuedAt ? p.queuedAt.toISOString() : null,
        calledAt: p.calledAt ? p.calledAt.toISOString() : null,
        completedAt: p.completedAt ? p.completedAt.toISOString() : null,
        queuePosition,
      },
      qrPayload: buildQrPayload(p.code),
      qrDataUrl,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
