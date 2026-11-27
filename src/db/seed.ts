import "dotenv/config";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, getPool } from "@/db";
import { auditLogs, participants, user } from "@/db/schema";

interface SeedUserInput {
  name: string;
  email: string;
  password: string;
  role: "admin" | "staff";
}

const SEED_USERS: SeedUserInput[] = [
  {
    name: "陈主任（管理员）",
    email: "admin@grad.edu",
    password: "Admin123!",
    role: "admin",
  },
  {
    name: "李老师（签到处）",
    email: "staff1@grad.edu",
    password: "Staff123!",
    role: "staff",
  },
  {
    name: "王老师（舞台组）",
    email: "staff2@grad.edu",
    password: "Staff123!",
    role: "staff",
  },
];

async function ensureSeedUser(input: SeedUserInput): Promise<string> {
  const existing = await db
    .select()
    .from(user)
    .where(eq(user.email, input.email))
    .limit(1);

  if (existing.length > 0) {
    if (existing[0].role !== input.role || existing[0].name !== input.name) {
      await db
        .update(user)
        .set({ role: input.role, name: input.name, emailVerified: true })
        .where(eq(user.id, existing[0].id));
    }
    return existing[0].id;
  }

  const created = await auth.api.signUpEmail({
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
    },
  });

  await db
    .update(user)
    .set({ role: input.role, emailVerified: true })
    .where(eq(user.id, created.user.id));

  return created.user.id;
}

async function main() {
  const reset = process.argv.includes("--reset");
  const userIds: Record<string, string> = {};

  for (const u of SEED_USERS) {
    userIds[u.email] = await ensureSeedUser(u);
  }

  if (reset) {
    await db.delete(auditLogs);
    await db.delete(participants);
  }

  const existingCount = await db.select({ id: participants.id }).from(participants).limit(1);
  if (existingCount.length > 0 && !reset) {
    console.log("Participants already exist; skipping seed. Pass --reset to reseed.");
    return;
  }

  const now = Date.now();
  const min = (m: number) => new Date(now - m * 60_000);
  const staff1Id = userIds["staff1@grad.edu"];
  const staff2Id = userIds["staff2@grad.edu"];
  const adminId = userIds["admin@grad.edu"];

  const sampleParticipants = [
    {
      code: "GRAD-2026-001",
      name: "林思语",
      email: "siyu.lin@grad.edu",
      checkedInAt: min(45),
      checkedInById: staff1Id,
      stageStatus: "COMPLETED" as const,
      queuedAt: min(35),
      queuedById: staff2Id,
      calledAt: min(25),
      calledById: staff2Id,
      completedAt: min(20),
      completedById: staff2Id,
    },
    {
      code: "GRAD-2026-002",
      name: "张子轩",
      email: "zixuan.zhang@grad.edu",
      checkedInAt: min(42),
      checkedInById: staff1Id,
      stageStatus: "COMPLETED" as const,
      queuedAt: min(32),
      queuedById: staff2Id,
      calledAt: min(19),
      calledById: staff2Id,
      completedAt: min(14),
      completedById: staff2Id,
    },
    {
      code: "GRAD-2026-003",
      name: "陈雨桐",
      email: "yutong.chen@grad.edu",
      checkedInAt: min(38),
      checkedInById: staff1Id,
      stageStatus: "ON_STAGE" as const,
      queuedAt: min(28),
      queuedById: staff2Id,
      calledAt: min(3),
      calledById: staff2Id,
      completedAt: null,
      completedById: null,
    },
    {
      code: "GRAD-2026-004",
      name: "王浩然",
      email: "haoran.wang@grad.edu",
      checkedInAt: min(35),
      checkedInById: adminId,
      stageStatus: "WAITING" as const,
      queuedAt: min(12),
      queuedById: staff2Id,
      calledAt: null,
      calledById: null,
      completedAt: null,
      completedById: null,
    },
    {
      code: "GRAD-2026-005",
      name: "刘芷若",
      email: "zhiruo.liu@grad.edu",
      checkedInAt: min(30),
      checkedInById: staff1Id,
      stageStatus: "WAITING" as const,
      queuedAt: min(8),
      queuedById: staff2Id,
      calledAt: null,
      calledById: null,
      completedAt: null,
      completedById: null,
    },
    {
      code: "GRAD-2026-006",
      name: "黄俊杰",
      email: "junjie.huang@grad.edu",
      checkedInAt: min(22),
      checkedInById: staff1Id,
      stageStatus: "NOT_QUEUED" as const,
      queuedAt: null,
      queuedById: null,
      calledAt: null,
      calledById: null,
      completedAt: null,
      completedById: null,
    },
    {
      code: "GRAD-2026-007",
      name: "赵雅婷",
      email: "yating.zhao@grad.edu",
      checkedInAt: min(18),
      checkedInById: staff1Id,
      stageStatus: "NOT_QUEUED" as const,
      queuedAt: null,
      queuedById: null,
      calledAt: null,
      calledById: null,
      completedAt: null,
      completedById: null,
    },
    {
      code: "GRAD-2026-008",
      name: "周明远",
      email: "mingyuan.zhou@grad.edu",
      checkedInAt: min(15),
      checkedInById: adminId,
      stageStatus: "NOT_QUEUED" as const,
      queuedAt: null,
      queuedById: null,
      calledAt: null,
      calledById: null,
      completedAt: null,
      completedById: null,
    },
    {
      code: "GRAD-2026-009",
      name: "吴诗涵",
      email: "shihan.wu@grad.edu",
      checkedInAt: null,
      checkedInById: null,
      stageStatus: "NOT_QUEUED" as const,
      queuedAt: null,
      queuedById: null,
      calledAt: null,
      calledById: null,
      completedAt: null,
      completedById: null,
    },
    {
      code: "GRAD-2026-010",
      name: "徐嘉诚",
      email: "jiacheng.xu@grad.edu",
      checkedInAt: null,
      checkedInById: null,
      stageStatus: "NOT_QUEUED" as const,
      queuedAt: null,
      queuedById: null,
      calledAt: null,
      calledById: null,
      completedAt: null,
      completedById: null,
    },
    {
      code: "GRAD-2026-011",
      name: "孙悦",
      email: "yue.sun@grad.edu",
      checkedInAt: null,
      checkedInById: null,
      stageStatus: "NOT_QUEUED" as const,
      queuedAt: null,
      queuedById: null,
      calledAt: null,
      calledById: null,
      completedAt: null,
      completedById: null,
    },
    {
      code: "GRAD-2026-012",
      name: "朱天宇",
      email: "tianyu.zhu@grad.edu",
      checkedInAt: null,
      checkedInById: null,
      stageStatus: "NOT_QUEUED" as const,
      queuedAt: null,
      queuedById: null,
      calledAt: null,
      calledById: null,
      completedAt: null,
      completedById: null,
    },
    {
      code: "GRAD-2026-013",
      name: "马若溪",
      email: "ruoxi.ma@grad.edu",
      checkedInAt: null,
      checkedInById: null,
      stageStatus: "NOT_QUEUED" as const,
      queuedAt: null,
      queuedById: null,
      calledAt: null,
      calledById: null,
      completedAt: null,
      completedById: null,
    },
    {
      code: "GRAD-2026-014",
      name: "胡致远",
      email: "zhiyuan.hu@grad.edu",
      checkedInAt: null,
      checkedInById: null,
      stageStatus: "NOT_QUEUED" as const,
      queuedAt: null,
      queuedById: null,
      calledAt: null,
      calledById: null,
      completedAt: null,
      completedById: null,
    },
    {
      code: "GRAD-2026-015",
      name: "郭心怡",
      email: "xinyi.guo@grad.edu",
      checkedInAt: null,
      checkedInById: null,
      stageStatus: "NOT_QUEUED" as const,
      queuedAt: null,
      queuedById: null,
      calledAt: null,
      calledById: null,
      completedAt: null,
      completedById: null,
    },
    {
      code: "GRAD-2026-016",
      name: "高宇航",
      email: "yuhang.gao@grad.edu",
      checkedInAt: null,
      checkedInById: null,
      stageStatus: "NOT_QUEUED" as const,
      queuedAt: null,
      queuedById: null,
      calledAt: null,
      calledById: null,
      completedAt: null,
      completedById: null,
    },
  ];

  await db.insert(participants).values(sampleParticipants);

  await db.insert(auditLogs).values({
    participantCode: "SYSTEM",
    action: "SEED_INIT",
    actorId: adminId,
    actorName: "系统初始化",
    detail: `初始化 ${sampleParticipants.length} 位毕业典礼参与者测试数据`,
  });

  console.log(`Seeded ${SEED_USERS.length} users and ${sampleParticipants.length} participants.`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end();
  });
