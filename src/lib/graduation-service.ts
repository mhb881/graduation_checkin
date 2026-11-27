import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "@/db";
import { auditLogs, participants, type StageStatus, user } from "@/db/schema";
import { buildQrPayload, generateQrDataUrl, parseParticipantLookupInput } from "@/lib/qr";
import { publishStageSnapshot, type StageSnapshot } from "@/lib/stage-events";

export interface ActorInfo {
  id: string;
  name: string;
}

export interface ParticipantDetail {
  id: number;
  code: string;
  name: string;
  email: string;
  qrPayload: string;
  checkedInAt: string | null;
  checkedInByName: string | null;
  stageStatus: StageStatus;
  queuedAt: string | null;
  queuedByName: string | null;
  calledAt: string | null;
  calledByName: string | null;
  completedAt: string | null;
  completedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly data?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

const checkedInUser = alias(user, "checked_in_user");
const queuedUser = alias(user, "queued_user");
const calledUser = alias(user, "called_user");
const completedUser = alias(user, "completed_user");

function toIso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

function mapParticipantDetail(row: {
  participant: typeof participants.$inferSelect;
  checkedInByName: string | null;
  queuedByName: string | null;
  calledByName: string | null;
  completedByName: string | null;
}): ParticipantDetail {
  const p = row.participant;
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    email: p.email,
    qrPayload: buildQrPayload(p.code),
    checkedInAt: toIso(p.checkedInAt),
    checkedInByName: row.checkedInByName,
    stageStatus: p.stageStatus,
    queuedAt: toIso(p.queuedAt),
    queuedByName: row.queuedByName,
    calledAt: toIso(p.calledAt),
    calledByName: row.calledByName,
    completedAt: toIso(p.completedAt),
    completedByName: row.completedByName,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function getParticipantByCode(
  db: Database,
  code: string
): Promise<ParticipantDetail | null> {
  const rows = await db
    .select({
      participant: participants,
      checkedInByName: checkedInUser.name,
      queuedByName: queuedUser.name,
      calledByName: calledUser.name,
      completedByName: completedUser.name,
    })
    .from(participants)
    .leftJoin(checkedInUser, eq(participants.checkedInById, checkedInUser.id))
    .leftJoin(queuedUser, eq(participants.queuedById, queuedUser.id))
    .leftJoin(calledUser, eq(participants.calledById, calledUser.id))
    .leftJoin(completedUser, eq(participants.completedById, completedUser.id))
    .where(eq(participants.code, code.trim().toUpperCase()))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }
  return mapParticipantDetail(rows[0]);
}

export async function getParticipantById(
  db: Database,
  id: number
): Promise<ParticipantDetail | null> {
  const rows = await db
    .select({
      participant: participants,
      checkedInByName: checkedInUser.name,
      queuedByName: queuedUser.name,
      calledByName: calledUser.name,
      completedByName: completedUser.name,
    })
    .from(participants)
    .leftJoin(checkedInUser, eq(participants.checkedInById, checkedInUser.id))
    .leftJoin(queuedUser, eq(participants.queuedById, queuedUser.id))
    .leftJoin(calledUser, eq(participants.calledById, calledUser.id))
    .leftJoin(completedUser, eq(participants.completedById, completedUser.id))
    .where(eq(participants.id, id))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }
  return mapParticipantDetail(rows[0]);
}

export async function listParticipants(
  db: Database,
  filters: {
    q?: string;
    checkInStatus?: "all" | "checked_in" | "not_checked_in";
    stageStatus?: "all" | StageStatus;
  }
): Promise<ParticipantDetail[]> {
  const conditions = [];

  if (filters.q) {
    const pattern = `%${filters.q}%`;
    conditions.push(
      or(
        ilike(participants.name, pattern),
        ilike(participants.email, pattern),
        ilike(participants.code, pattern)
      )
    );
  }

  if (filters.checkInStatus === "checked_in") {
    conditions.push(isNotNull(participants.checkedInAt));
  } else if (filters.checkInStatus === "not_checked_in") {
    conditions.push(isNull(participants.checkedInAt));
  }

  if (filters.stageStatus && filters.stageStatus !== "all") {
    conditions.push(eq(participants.stageStatus, filters.stageStatus));
  }

  const rows = await db
    .select({
      participant: participants,
      checkedInByName: checkedInUser.name,
      queuedByName: queuedUser.name,
      calledByName: calledUser.name,
      completedByName: completedUser.name,
    })
    .from(participants)
    .leftJoin(checkedInUser, eq(participants.checkedInById, checkedInUser.id))
    .leftJoin(queuedUser, eq(participants.queuedById, queuedUser.id))
    .leftJoin(calledUser, eq(participants.calledById, calledUser.id))
    .leftJoin(completedUser, eq(participants.completedById, completedUser.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(participants.code));

  return rows.map(mapParticipantDetail);
}

async function generateNextParticipantCode(db: Database): Promise<string> {
  const [{ maxId }] = await db
    .select({
      maxId: sql<number>`coalesce(max(${participants.id}), 0)`,
    })
    .from(participants);

  const candidateNum = Number(maxId) + 1;
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `GRAD-2026-${String(candidateNum + attempt).padStart(3, "0")}`;
    const existing = await db
      .select({ id: participants.id })
      .from(participants)
      .where(eq(participants.code, candidate))
      .limit(1);
    if (existing.length === 0) {
      return candidate;
    }
  }

  return `GRAD-${Date.now().toString(36).toUpperCase()}`;
}

function isPgUniqueViolation(err: unknown): { isUnique: boolean; constraint?: string } {
  if (typeof err === "object" && err !== null) {
    const pgErr = err as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
    const code = pgErr.code ?? pgErr.cause?.code;
    const constraint = pgErr.constraint ?? pgErr.cause?.constraint;
    if (code === "23505") {
      return { isUnique: true, constraint };
    }
  }
  return { isUnique: false };
}

export async function createParticipant(
  db: Database,
  input: { name: string; email: string; code?: string },
  actor: ActorInfo
): Promise<{ participant: ParticipantDetail; qrDataUrl: string }> {
  const finalCode = input.code?.trim()
    ? input.code.trim().toUpperCase()
    : await generateNextParticipantCode(db);

  try {
    const [inserted] = await db
      .insert(participants)
      .values({
        code: finalCode,
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
      })
      .returning();

    await db.insert(auditLogs).values({
      participantId: inserted.id,
      participantCode: inserted.code,
      action: "PARTICIPANT_CREATE",
      actorId: actor.id,
      actorName: actor.name,
      detail: `新增参与者 ${inserted.name} (${inserted.code})`,
    });

    await broadcastCurrentStageSnapshot(db);

    const detail = (await getParticipantById(db, inserted.id))!;
    const qrDataUrl = await generateQrDataUrl(detail.code);
    return { participant: detail, qrDataUrl };
  } catch (err) {
    const unique = isPgUniqueViolation(err);
    if (unique.isUnique) {
      if (unique.constraint?.includes("email")) {
        throw new ServiceError(409, "EMAIL_EXISTS", "该邮箱已被其他参与者使用");
      }
      if (unique.constraint?.includes("code")) {
        throw new ServiceError(409, "CODE_EXISTS", "该参与者编号已存在");
      }
      throw new ServiceError(409, "DUPLICATE_PARTICIPANT", "参与者编号或邮箱已存在");
    }
    throw err;
  }
}

export async function updateParticipant(
  db: Database,
  id: number,
  input: { name?: string; email?: string; code?: string },
  actor: ActorInfo
): Promise<ParticipantDetail> {
  const existing = await getParticipantById(db, id);
  if (!existing) {
    throw new ServiceError(404, "PARTICIPANT_NOT_FOUND", "未找到该参与者");
  }

  try {
    const [updated] = await db
      .update(participants)
      .set({
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
        ...(input.code !== undefined ? { code: input.code.trim().toUpperCase() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(participants.id, id))
      .returning();

    await db.insert(auditLogs).values({
      participantId: updated.id,
      participantCode: updated.code,
      action: "PARTICIPANT_UPDATE",
      actorId: actor.id,
      actorName: actor.name,
      detail: `更新参与者资料 ${updated.name} (${updated.code})`,
    });

    await broadcastCurrentStageSnapshot(db);
    return (await getParticipantById(db, updated.id))!;
  } catch (err) {
    const unique = isPgUniqueViolation(err);
    if (unique.isUnique) {
      if (unique.constraint?.includes("email")) {
        throw new ServiceError(409, "EMAIL_EXISTS", "该邮箱已被其他参与者使用");
      }
      if (unique.constraint?.includes("code")) {
        throw new ServiceError(409, "CODE_EXISTS", "该参与者编号已存在");
      }
      throw new ServiceError(409, "DUPLICATE_PARTICIPANT", "参与者编号或邮箱已存在");
    }
    throw err;
  }
}

export async function lookupParticipantFromScan(
  db: Database,
  raw: string,
  mode: "qr" | "manual" | "auto" = "auto"
): Promise<ParticipantDetail> {
  const parsed = parseParticipantLookupInput(raw, mode);
  if (!parsed.ok) {
    throw new ServiceError(400, parsed.errorCode, parsed.message);
  }

  const participant = await getParticipantByCode(db, parsed.code);
  if (!participant) {
    throw new ServiceError(
      404,
      "PARTICIPANT_NOT_FOUND",
      `未找到编号为 ${parsed.code} 的参与者`
    );
  }

  return participant;
}

export async function checkInParticipant(
  db: Database,
  raw: string,
  mode: "qr" | "manual" | "auto",
  actor: ActorInfo,
  options?: { broadcast?: boolean }
): Promise<ParticipantDetail> {
  const parsed = parseParticipantLookupInput(raw, mode);
  if (!parsed.ok) {
    await db.insert(auditLogs).values({
      action: parsed.errorCode,
      actorId: actor.id,
      actorName: actor.name,
      detail: `签到扫描异常 (${mode}): ${parsed.message}`,
    });
    throw new ServiceError(400, parsed.errorCode, parsed.message);
  }

  const result = await db.transaction(async (tx) => {
    const existingRows = await tx
      .select({ id: participants.id })
      .from(participants)
      .where(eq(participants.code, parsed.code))
      .limit(1);

    if (existingRows.length === 0) {
      await tx.insert(auditLogs).values({
        participantCode: parsed.code,
        action: "CHECK_IN_NOT_FOUND",
        actorId: actor.id,
        actorName: actor.name,
        detail: `尝试签到不存在的编号 ${parsed.code}`,
      });
      return { status: "NOT_FOUND" as const };
    }

    const updatedRows = await tx
      .update(participants)
      .set({
        checkedInAt: new Date(),
        checkedInById: actor.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(participants.id, existingRows[0].id),
          isNull(participants.checkedInAt)
        )
      )
      .returning();

    if (updatedRows.length === 0) {
      await tx.insert(auditLogs).values({
        participantId: existingRows[0].id,
        participantCode: parsed.code,
        action: "CHECK_IN_CONFLICT",
        actorId: actor.id,
        actorName: actor.name,
        detail: `拦截重复签到：${parsed.code}`,
      });
      return { status: "ALREADY_CHECKED_IN" as const, id: existingRows[0].id };
    }

    await tx.insert(auditLogs).values({
      participantId: updatedRows[0].id,
      participantCode: updatedRows[0].code,
      action: "CHECK_IN",
      actorId: actor.id,
      actorName: actor.name,
      detail: `${updatedRows[0].name} (${updatedRows[0].code}) 完成签到`,
    });

    return { status: "OK" as const, id: updatedRows[0].id };
  });

  if (result.status === "NOT_FOUND") {
    throw new ServiceError(
      404,
      "PARTICIPANT_NOT_FOUND",
      `未找到编号为 ${parsed.code} 的参与者`
    );
  }

  const detail = (await getParticipantById(db, result.id))!;

  if (result.status === "ALREADY_CHECKED_IN") {
    throw new ServiceError(
      409,
      "ALREADY_CHECKED_IN",
      `${detail.name}（${detail.code}）已完成签到，不可重复签到`,
      { participant: detail }
    );
  }

  if (options?.broadcast !== false) {
    await broadcastCurrentStageSnapshot(db);
  }

  return detail;
}

export async function joinStageQueue(
  db: Database,
  raw: string,
  mode: "qr" | "manual" | "auto",
  actor: ActorInfo,
  options?: { broadcast?: boolean }
): Promise<ParticipantDetail> {
  const parsed = parseParticipantLookupInput(raw, mode);
  if (!parsed.ok) {
    await db.insert(auditLogs).values({
      action: parsed.errorCode,
      actorId: actor.id,
      actorName: actor.name,
      detail: `舞台入队扫描异常 (${mode}): ${parsed.message}`,
    });
    throw new ServiceError(400, parsed.errorCode, parsed.message);
  }

  const outcome = await db.transaction(async (tx) => {
    const locked = await tx
      .select()
      .from(participants)
      .where(eq(participants.code, parsed.code))
      .for("update");

    if (locked.length === 0) {
      return { status: "NOT_FOUND" as const };
    }

    const row = locked[0];
    if (!row.checkedInAt) {
      await tx.insert(auditLogs).values({
        participantId: row.id,
        participantCode: row.code,
        action: "QUEUE_REJECT_UNCHECKED",
        actorId: actor.id,
        actorName: actor.name,
        detail: `${row.name} (${row.code}) 未签到尝试进入舞台队列`,
      });
      return { status: "NOT_CHECKED_IN" as const, id: row.id };
    }

    if (row.stageStatus === "WAITING") {
      return { status: "ALREADY_IN_QUEUE" as const, id: row.id };
    }
    if (row.stageStatus === "ON_STAGE") {
      return { status: "ALREADY_ON_STAGE" as const, id: row.id };
    }
    if (row.stageStatus === "COMPLETED") {
      return { status: "ALREADY_COMPLETED" as const, id: row.id };
    }

    const now = new Date();
    await tx
      .update(participants)
      .set({
        stageStatus: "WAITING",
        queuedAt: now,
        queuedById: actor.id,
        updatedAt: now,
      })
      .where(eq(participants.id, row.id));

    await tx.insert(auditLogs).values({
      participantId: row.id,
      participantCode: row.code,
      action: "QUEUE_JOIN",
      actorId: actor.id,
      actorName: actor.name,
      detail: `${row.name} (${row.code}) 加入舞台等候队列`,
    });

    return { status: "OK" as const, id: row.id };
  });

  if (outcome.status === "NOT_FOUND") {
    throw new ServiceError(
      404,
      "PARTICIPANT_NOT_FOUND",
      `未找到编号为 ${parsed.code} 的参与者`
    );
  }

  const detail = (await getParticipantById(db, outcome.id))!;

  if (outcome.status === "NOT_CHECKED_IN") {
    throw new ServiceError(
      409,
      "NOT_CHECKED_IN",
      `${detail.name}（${detail.code}）尚未入场签到，仅已签到参与者可进入舞台队列`,
      { participant: detail }
    );
  }
  if (outcome.status === "ALREADY_IN_QUEUE") {
    throw new ServiceError(
      409,
      "ALREADY_IN_QUEUE",
      `${detail.name}（${detail.code}）已在舞台等候队列中，请勿重复加入`,
      { participant: detail }
    );
  }
  if (outcome.status === "ALREADY_ON_STAGE") {
    throw new ServiceError(
      409,
      "ALREADY_ON_STAGE",
      `${detail.name}（${detail.code}）当前正在台上`,
      { participant: detail }
    );
  }
  if (outcome.status === "ALREADY_COMPLETED") {
    throw new ServiceError(
      409,
      "ALREADY_COMPLETED",
      `${detail.name}（${detail.code}）已完成上台流程`,
      { participant: detail }
    );
  }

  if (options?.broadcast !== false) {
    await broadcastCurrentStageSnapshot(db);
  }

  return detail;
}

export async function callNextParticipant(
  db: Database,
  actor: ActorInfo,
  options?: { autoCompleteCurrent?: boolean; broadcast?: boolean }
): Promise<{
  completedParticipant: ParticipantDetail | null;
  currentOnStage: ParticipantDetail;
  snapshot: StageSnapshot;
}> {
  const autoCompleteCurrent = options?.autoCompleteCurrent ?? true;

  const outcome = await db.transaction(async (tx) => {
    const activeRows = await tx
      .select()
      .from(participants)
      .where(
        or(
          eq(participants.stageStatus, "ON_STAGE"),
          eq(participants.stageStatus, "WAITING")
        )
      )
      .orderBy(asc(participants.queuedAt), asc(participants.id))
      .for("update");

    const currentOnStage = activeRows.find((r) => r.stageStatus === "ON_STAGE") ?? null;
    const waitingQueue = activeRows.filter((r) => r.stageStatus === "WAITING");

    if (waitingQueue.length === 0) {
      return { status: "QUEUE_EMPTY" as const };
    }

    if (currentOnStage && !autoCompleteCurrent) {
      return { status: "STAGE_OCCUPIED" as const, currentId: currentOnStage.id };
    }

    const now = new Date();
    let completedId: number | null = null;

    if (currentOnStage) {
      await tx
        .update(participants)
        .set({
          stageStatus: "COMPLETED",
          completedAt: now,
          completedById: actor.id,
          updatedAt: now,
        })
        .where(eq(participants.id, currentOnStage.id));

      await tx.insert(auditLogs).values({
        participantId: currentOnStage.id,
        participantCode: currentOnStage.code,
        action: "STAGE_COMPLETE",
        actorId: actor.id,
        actorName: actor.name,
        detail: `呼叫下一位时自动完成 ${currentOnStage.name} (${currentOnStage.code}) 上台流程`,
      });
      completedId = currentOnStage.id;
    }

    const nextParticipant = waitingQueue[0];
    await tx
      .update(participants)
      .set({
        stageStatus: "ON_STAGE",
        calledAt: now,
        calledById: actor.id,
        updatedAt: now,
      })
      .where(eq(participants.id, nextParticipant.id));

    await tx.insert(auditLogs).values({
      participantId: nextParticipant.id,
      participantCode: nextParticipant.code,
      action: "STAGE_CALL_NEXT",
      actorId: actor.id,
      actorName: actor.name,
      detail: `呼叫 ${nextParticipant.name} (${nextParticipant.code}) 上台`,
    });

    return {
      status: "OK" as const,
      completedId,
      nextId: nextParticipant.id,
    };
  });

  if (outcome.status === "QUEUE_EMPTY") {
    throw new ServiceError(
      409,
      "QUEUE_EMPTY",
      "当前舞台等候队列为空，暂无下一位可呼叫的参与者"
    );
  }

  if (outcome.status === "STAGE_OCCUPIED") {
    const current = (await getParticipantById(db, outcome.currentId))!;
    throw new ServiceError(
      409,
      "STAGE_OCCUPIED",
      `当前 ${current.name}（${current.code}）仍在台上，请先确认其完成上台`,
      { currentOnStage: current }
    );
  }

  const completedParticipant = outcome.completedId
    ? await getParticipantById(db, outcome.completedId)
    : null;
  const currentOnStage = (await getParticipantById(db, outcome.nextId))!;
  const snapshot = await getStageSnapshot(db);

  if (options?.broadcast !== false) {
    publishStageSnapshot(snapshot);
  }

  return { completedParticipant, currentOnStage, snapshot };
}

export async function completeCurrentOnStage(
  db: Database,
  actor: ActorInfo,
  options?: { broadcast?: boolean }
): Promise<{ completedParticipant: ParticipantDetail; snapshot: StageSnapshot }> {
  const outcome = await db.transaction(async (tx) => {
    const onStageRows = await tx
      .select()
      .from(participants)
      .where(eq(participants.stageStatus, "ON_STAGE"))
      .for("update");

    if (onStageRows.length === 0) {
      return { status: "NO_ONE_ON_STAGE" as const };
    }

    const current = onStageRows[0];
    const now = new Date();
    await tx
      .update(participants)
      .set({
        stageStatus: "COMPLETED",
        completedAt: now,
        completedById: actor.id,
        updatedAt: now,
      })
      .where(eq(participants.id, current.id));

    await tx.insert(auditLogs).values({
      participantId: current.id,
      participantCode: current.code,
      action: "STAGE_COMPLETE",
      actorId: actor.id,
      actorName: actor.name,
      detail: `确认 ${current.name} (${current.code}) 完成上台流程`,
    });

    return { status: "OK" as const, id: current.id };
  });

  if (outcome.status === "NO_ONE_ON_STAGE") {
    throw new ServiceError(
      409,
      "NO_ONE_ON_STAGE",
      "当前没有正在台上的参与者"
    );
  }

  const completedParticipant = (await getParticipantById(db, outcome.id))!;
  const snapshot = await getStageSnapshot(db);

  if (options?.broadcast !== false) {
    publishStageSnapshot(snapshot);
  }

  return { completedParticipant, snapshot };
}

export async function getDashboardStats(db: Database) {
  const [counts] = await db
    .select({
      totalRegistered: sql<number>`count(*)::int`,
      checkedInCount: sql<number>`count(*) filter (where ${participants.checkedInAt} is not null)::int`,
      notCheckedInCount: sql<number>`count(*) filter (where ${participants.checkedInAt} is null)::int`,
      waitingCount: sql<number>`count(*) filter (where ${participants.stageStatus} = 'WAITING')::int`,
      onStageCount: sql<number>`count(*) filter (where ${participants.stageStatus} = 'ON_STAGE')::int`,
      completedCount: sql<number>`count(*) filter (where ${participants.stageStatus} = 'COMPLETED')::int`,
    })
    .from(participants);

  return {
    totalRegistered: counts?.totalRegistered ?? 0,
    checkedInCount: counts?.checkedInCount ?? 0,
    notCheckedInCount: counts?.notCheckedInCount ?? 0,
    waitingCount: counts?.waitingCount ?? 0,
    onStageCount: counts?.onStageCount ?? 0,
    completedCount: counts?.completedCount ?? 0,
  };
}

export async function getStageSnapshot(db: Database): Promise<StageSnapshot> {
  const [stats, onStageRows, waitingRows, recentCompletedRows] = await Promise.all([
    getDashboardStats(db),
    db
      .select({
        participant: participants,
        calledByName: calledUser.name,
      })
      .from(participants)
      .leftJoin(calledUser, eq(participants.calledById, calledUser.id))
      .where(eq(participants.stageStatus, "ON_STAGE"))
      .limit(1),
    db
      .select({
        participant: participants,
        queuedByName: queuedUser.name,
      })
      .from(participants)
      .leftJoin(queuedUser, eq(participants.queuedById, queuedUser.id))
      .where(eq(participants.stageStatus, "WAITING"))
      .orderBy(asc(participants.queuedAt), asc(participants.id)),
    db
      .select({
        id: participants.id,
        code: participants.code,
        name: participants.name,
        completedAt: participants.completedAt,
      })
      .from(participants)
      .where(eq(participants.stageStatus, "COMPLETED"))
      .orderBy(desc(participants.completedAt), desc(participants.id))
      .limit(5),
  ]);

  const current = onStageRows[0];

  return {
    currentOnStage: current
      ? {
          id: current.participant.id,
          code: current.participant.code,
          name: current.participant.name,
          email: current.participant.email,
          calledAt: toIso(current.participant.calledAt),
          calledByName: current.calledByName,
        }
      : null,
    waitingQueue: waitingRows.map((w) => ({
      id: w.participant.id,
      code: w.participant.code,
      name: w.participant.name,
      queuedAt: (w.participant.queuedAt ?? w.participant.createdAt).toISOString(),
      queuedByName: w.queuedByName,
    })),
    recentCompleted: recentCompletedRows.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      completedAt: toIso(c.completedAt),
    })),
    stats,
    updatedAt: new Date().toISOString(),
  };
}

export async function getPublicDisplayState(db: Database) {
  const snapshot = await getStageSnapshot(db);
  return {
    currentOnStage: snapshot.currentOnStage
      ? {
          code: snapshot.currentOnStage.code,
          name: snapshot.currentOnStage.name,
          calledAt: snapshot.currentOnStage.calledAt,
        }
      : null,
    nextInQueue: snapshot.waitingQueue[0]
      ? {
          code: snapshot.waitingQueue[0].code,
          name: snapshot.waitingQueue[0].name,
        }
      : null,
    waitingCount: snapshot.stats.waitingCount,
    completedCount: snapshot.stats.completedCount,
    updatedAt: snapshot.updatedAt,
  };
}

export async function broadcastCurrentStageSnapshot(db: Database): Promise<StageSnapshot> {
  const snapshot = await getStageSnapshot(db);
  publishStageSnapshot(snapshot);
  return snapshot;
}

export async function listRecentAuditLogs(db: Database, limit = 20) {
  return db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(limit);
}
