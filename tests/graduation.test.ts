import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, getPool } from "@/db";
import { auditLogs, participants, user } from "@/db/schema";
import {
  callNextParticipant,
  checkInParticipant,
  completeCurrentOnStage,
  createParticipant,
  getDashboardStats,
  getStageSnapshot,
  joinStageQueue,
  listParticipants,
  lookupParticipantFromScan,
  ServiceError,
} from "@/lib/graduation-service";
import { buildQrPayload, parseParticipantLookupInput } from "@/lib/qr";
import { auth } from "@/lib/auth";
import { POST as createParticipantRoute } from "@/app/api/participants/route";
import { POST as checkInRoute } from "@/app/api/checkin/confirm/route";
import { POST as passRoute } from "@/app/api/pass/route";

const adminActor = { id: "test-admin-1", name: "测试管理员" };
const staffActor1 = { id: "test-staff-1", name: "测试签到员A" };
const staffActor2 = { id: "test-staff-2", name: "测试舞台员B" };

async function resetTestTables() {
  await db.delete(auditLogs);
  await db.delete(participants);
}

describe("Graduation Check-in & Stage Management Core Logic", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes("graduation_checkin_test")) {
      throw new Error("Refusing to run tests against non-test database");
    }
    await resetTestTables();
    await db
      .insert(user)
      .values([
        {
          id: adminActor.id,
          name: adminActor.name,
          email: "test-admin@grad.edu",
          emailVerified: true,
          role: "admin",
        },
        {
          id: staffActor1.id,
          name: staffActor1.name,
          email: "test-staff1@grad.edu",
          emailVerified: true,
          role: "staff",
        },
        {
          id: staffActor2.id,
          name: staffActor2.name,
          email: "test-staff2@grad.edu",
          emailVerified: true,
          role: "staff",
        },
      ])
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await resetTestTables();
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("validates signed QR payloads and rejects malformed or tampered codes", () => {
    const validQr = buildQrPayload("grad-2026-101");
    const parsed = parseParticipantLookupInput(validQr, "qr");
    expect(parsed).toEqual({
      ok: true,
      code: "GRAD-2026-101",
      mode: "qr",
    });

    const malformed = parseParticipantLookupInput("not-a-json-qr", "qr");
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) {
      expect(malformed.errorCode).toBe("INVALID_QR_FORMAT");
    }

    const tamperedObj = JSON.parse(validQr);
    tamperedObj.sig = "0000000000000000";
    const tampered = parseParticipantLookupInput(JSON.stringify(tamperedObj), "qr");
    expect(tampered.ok).toBe(false);
    if (!tampered.ok) {
      expect(tampered.errorCode).toBe("INVALID_QR_SIGNATURE");
    }

    const manual = parseParticipantLookupInput("grad-2026-101", "manual");
    expect(manual).toEqual({
      ok: true,
      code: "GRAD-2026-101",
      mode: "manual",
    });
  });

  it("enforces unique participant code and email, and supports search & filtering", async () => {
    const p1 = await createParticipant(
      db,
      { name: "王小明", email: "xiaoming@grad.edu", code: "GRAD-101" },
      adminActor
    );
    expect(p1.participant.code).toBe("GRAD-101");
    expect(p1.qrDataUrl.startsWith("data:image/png;base64,")).toBe(true);

    await expect(
      createParticipant(
        db,
        { name: "重名", email: "xiaoming@grad.edu", code: "GRAD-102" },
        adminActor
      )
    ).rejects.toMatchObject({ status: 409, code: "EMAIL_EXISTS" });

    await expect(
      createParticipant(
        db,
        { name: "重编号", email: "other@grad.edu", code: "GRAD-101" },
        adminActor
      )
    ).rejects.toMatchObject({ status: 409, code: "CODE_EXISTS" });

    const p2 = await createParticipant(
      db,
      { name: "李华", email: "lihua@grad.edu" },
      adminActor
    );
    await checkInParticipant(db, p2.participant.code, "manual", staffActor1);

    const checkedOnly = await listParticipants(db, { checkInStatus: "checked_in" });
    expect(checkedOnly).toHaveLength(1);
    expect(checkedOnly[0].code).toBe(p2.participant.code);

    const searchByName = await listParticipants(db, { q: "小明" });
    expect(searchByName).toHaveLength(1);
    expect(searchByName[0].code).toBe("GRAD-101");
  });

  it("prevents duplicate check-in under concurrent multi-device requests", async () => {
    const { participant } = await createParticipant(
      db,
      { name: "并发测试生", email: "race@grad.edu", code: "GRAD-RACE-01" },
      adminActor
    );

    const qr = participant.qrPayload;
    const attempts = await Promise.allSettled([
      checkInParticipant(db, qr, "qr", staffActor1, { broadcast: false }),
      checkInParticipant(db, qr, "qr", staffActor2, { broadcast: false }),
      checkInParticipant(db, qr, "qr", staffActor1, { broadcast: false }),
      checkInParticipant(db, qr, "qr", staffActor2, { broadcast: false }),
      checkInParticipant(db, qr, "qr", adminActor, { broadcast: false }),
    ]);

    const succeeded = attempts.filter((r) => r.status === "fulfilled");
    const failed = attempts.filter((r) => r.status === "rejected");

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(4);
    for (const f of failed) {
      if (f.status === "rejected") {
        expect(f.reason).toBeInstanceOf(ServiceError);
        expect((f.reason as ServiceError).code).toBe("ALREADY_CHECKED_IN");
      }
    }

    const lookedUp = await lookupParticipantFromScan(db, qr, "qr");
    expect(lookedUp.checkedInAt).not.toBeNull();
    expect(lookedUp.checkedInByName).toBeTruthy();
  });

  it("enforces check-in prerequisite, FIFO stage queue, concurrency safety, and single on-stage constraint", async () => {
    const { participant: p1 } = await createParticipant(
      db,
      { name: "甲同学", email: "p1@grad.edu", code: "GRAD-201" },
      adminActor
    );
    const { participant: p2 } = await createParticipant(
      db,
      { name: "乙同学", email: "p2@grad.edu", code: "GRAD-202" },
      adminActor
    );

    // 1. Unchecked-in participant cannot join stage queue
    await expect(
      joinStageQueue(db, p1.qrPayload, "qr", staffActor2, { broadcast: false })
    ).rejects.toMatchObject({ status: 409, code: "NOT_CHECKED_IN" });

    // 2. Check in both participants
    await checkInParticipant(db, p1.qrPayload, "qr", staffActor1, { broadcast: false });
    await checkInParticipant(db, p2.qrPayload, "qr", staffActor1, { broadcast: false });

    // 3. Concurrent join queue for p1: only 1 succeeds
    const joinRace = await Promise.allSettled([
      joinStageQueue(db, p1.qrPayload, "qr", staffActor2, { broadcast: false }),
      joinStageQueue(db, p1.qrPayload, "qr", staffActor1, { broadcast: false }),
      joinStageQueue(db, p1.qrPayload, "qr", adminActor, { broadcast: false }),
    ]);
    expect(joinRace.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(joinRace.filter((r) => r.status === "rejected")).toHaveLength(2);

    // 4. p2 joins after p1 (FIFO)
    await new Promise((r) => setTimeout(r, 15));
    await joinStageQueue(db, p2.qrPayload, "qr", staffActor2, { broadcast: false });

    const snapBeforeCall = await getStageSnapshot(db);
    expect(snapBeforeCall.waitingQueue.map((w) => w.code)).toEqual([
      "GRAD-201",
      "GRAD-202",
    ]);

    // 5. Concurrent callNext from two devices with expectedCurrentId: strictly 1 succeeds, 1 gets STAGE_STATE_CHANGED
    const callRace = await Promise.allSettled([
      callNextParticipant(db, staffActor2, {
        broadcast: false,
        expectedCurrentId: null,
        expectedNextId: p1.id,
      }),
      callNextParticipant(db, staffActor1, {
        broadcast: false,
        expectedCurrentId: null,
        expectedNextId: p1.id,
      }),
    ]);
    const raceSuccess = callRace.filter((r) => r.status === "fulfilled");
    const raceRejected = callRace.filter((r) => r.status === "rejected");
    expect(raceSuccess).toHaveLength(1);
    expect(raceRejected).toHaveLength(1);
    if (raceSuccess[0].status === "fulfilled") {
      expect(raceSuccess[0].value.currentOnStage.code).toBe("GRAD-201");
      expect(raceSuccess[0].value.completedParticipant).toBeNull();
    }
    if (raceRejected[0].status === "rejected") {
      expect(raceRejected[0].reason).toMatchObject({
        status: 409,
        code: "STAGE_STATE_CHANGED",
      });
    }

    // 6. When autoCompleteCurrent = false, calling next while someone is on stage rejects
    await expect(
      callNextParticipant(db, staffActor2, {
        autoCompleteCurrent: false,
        broadcast: false,
      })
    ).rejects.toMatchObject({ status: 409, code: "STAGE_OCCUPIED" });

    // 7. DB partial unique index prevents two ON_STAGE rows even via raw update
    await expect(
      db
        .update(participants)
        .set({ stageStatus: "ON_STAGE" })
        .where(eq(participants.code, "GRAD-202"))
    ).rejects.toThrow();

    // 8. Call next with default autoCompleteCurrent completes p1 and moves p2 ON_STAGE
    const secondCall = await callNextParticipant(db, staffActor2, { broadcast: false });
    expect(secondCall.completedParticipant?.code).toBe("GRAD-201");
    expect(secondCall.currentOnStage.code).toBe("GRAD-202");

    // 9. Complete p2 explicitly
    const completed = await completeCurrentOnStage(db, staffActor2, { broadcast: false });
    expect(completed.completedParticipant.code).toBe("GRAD-202");

    // 10. Completing again throws NO_ONE_ON_STAGE
    await expect(
      completeCurrentOnStage(db, staffActor2, { broadcast: false })
    ).rejects.toMatchObject({ status: 409, code: "NO_ONE_ON_STAGE" });

    // 11. Dashboard stats match final state
    const stats = await getDashboardStats(db);
    expect(stats).toEqual({
      totalRegistered: 2,
      checkedInCount: 2,
      notCheckedInCount: 0,
      waitingCount: 0,
      onStageCount: 0,
      completedCount: 2,
    });
  });

  it("enforces authentication and admin/staff RBAC on API route handlers", async () => {
    // Ensure Better Auth test accounts exist in test DB
    const ensureAuthUser = async (
      name: string,
      email: string,
      password: string,
      role: "admin" | "staff"
    ) => {
      const found = await db
        .select()
        .from(user)
        .where(eq(user.email, email))
        .limit(1);
      if (found.length === 0) {
        const res = await auth.api.signUpEmail({
          body: { name, email, password },
        });
        await db
          .update(user)
          .set({ role, emailVerified: true })
          .where(eq(user.id, res.user.id));
      }
    };

    await ensureAuthUser("API Admin", "api-admin@grad.edu", "Admin123!", "admin");
    await ensureAuthUser("API Staff", "api-staff@grad.edu", "Staff123!", "staff");

    // Unauthenticated request -> 401
    const unauthRes = await createParticipantRoute(
      new Request("http://localhost:3000/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test", email: "t@grad.edu" }),
      })
    );
    expect(unauthRes.status).toBe(401);

    // Sign in as staff -> get session cookie
    const staffSignIn = await auth.api.signInEmail({
      body: { email: "api-staff@grad.edu", password: "Staff123!" },
      asResponse: true,
    });
    const staffCookie = staffSignIn.headers.get("set-cookie") ?? "";
    expect(staffCookie).toContain("better-auth");

    // Staff cannot create participant -> 403
    const forbiddenRes = await createParticipantRoute(
      new Request("http://localhost:3000/api/participants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: staffCookie,
        },
        body: JSON.stringify({ name: "Unauthorized", email: "u@grad.edu" }),
      })
    );
    expect(forbiddenRes.status).toBe(403);

    // Sign in as admin -> create participant -> 201
    const adminSignIn = await auth.api.signInEmail({
      body: { email: "api-admin@grad.edu", password: "Admin123!" },
      asResponse: true,
    });
    const adminCookie = adminSignIn.headers.get("set-cookie") ?? "";

    const createdRes = await createParticipantRoute(
      new Request("http://localhost:3000/api/participants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: adminCookie,
        },
        body: JSON.stringify({
          name: "接口测试毕业生",
          email: "api-grad@grad.edu",
          code: "GRAD-API-01",
        }),
      })
    );
    expect(createdRes.status).toBe(201);

    // Staff CAN perform check-in -> 200
    const checkInRes = await checkInRoute(
      new Request("http://localhost:3000/api/checkin/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: staffCookie,
        },
        body: JSON.stringify({ raw: "GRAD-API-01", mode: "manual" }),
      })
    );
    expect(checkInRes.status).toBe(200);

    // Participant pass lookup requires matching code + email
    const wrongPassRes = await passRoute(
      new Request("http://localhost:3000/api/pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "GRAD-API-01", email: "wrong@grad.edu" }),
      })
    );
    expect(wrongPassRes.status).toBe(404);

    const validPassRes = await passRoute(
      new Request("http://localhost:3000/api/pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "GRAD-API-01", email: "api-grad@grad.edu" }),
      })
    );
    expect(validPassRes.status).toBe(200);
    const validPassBody = (await validPassRes.json()) as {
      qrDataUrl: string;
      participant: {
        code: string;
        checkedInAt: string | null;
        queuePosition: number | null;
      };
    };
    expect(validPassBody.qrDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(validPassBody.participant.code).toBe("GRAD-API-01");
    expect(validPassBody.participant.checkedInAt).not.toBeNull();
    expect(validPassBody.participant.queuePosition).toBeNull();

    // Join stage queue and verify pass lookup by name + email returns queuePosition = 1
    await joinStageQueue(db, "GRAD-API-01", "manual", staffActor2, {
      broadcast: false,
    });

    const byNamePassRes = await passRoute(
      new Request("http://localhost:3000/api/pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: "接口测试毕业生",
          email: "api-grad@grad.edu",
        }),
      })
    );
    expect(byNamePassRes.status).toBe(200);
    const byNameBody = (await byNamePassRes.json()) as {
      participant: { code: string; stageStatus: string; queuePosition: number | null };
    };
    expect(byNameBody.participant.code).toBe("GRAD-API-01");
    expect(byNameBody.participant.stageStatus).toBe("WAITING");
    expect(byNameBody.participant.queuePosition).toBe(1);
  });
});
