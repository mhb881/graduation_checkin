import { z } from "zod";

export const participantCodeRegex = /^[A-Za-z0-9_-]+$/;

export const createParticipantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "姓名不能为空")
    .max(120, "姓名不能超过 120 个字符"),
  email: z
    .string()
    .trim()
    .email("请输入有效的邮箱地址")
    .max(255, "邮箱不能超过 255 个字符")
    .transform((v) => v.toLowerCase()),
  code: z
    .string()
    .trim()
    .min(2, "唯一编号至少 2 个字符")
    .max(32, "唯一编号不能超过 32 个字符")
    .regex(participantCodeRegex, "唯一编号仅支持字母、数字、连字符和下划线")
    .transform((v) => v.toUpperCase())
    .optional()
    .or(z.literal("")),
});

export const updateParticipantSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "姓名不能为空")
      .max(120, "姓名不能超过 120 个字符")
      .optional(),
    email: z
      .string()
      .trim()
      .email("请输入有效的邮箱地址")
      .max(255, "邮箱不能超过 255 个字符")
      .transform((v) => v.toLowerCase())
      .optional(),
    code: z
      .string()
      .trim()
      .min(2, "唯一编号至少 2 个字符")
      .max(32, "唯一编号不能超过 32 个字符")
      .regex(participantCodeRegex, "唯一编号仅支持字母、数字、连字符和下划线")
      .transform((v) => v.toUpperCase())
      .optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.email !== undefined ||
      data.code !== undefined,
    { message: "请至少提供一项需要修改的资料" }
  );

export const scanInputSchema = z.object({
  raw: z.string().trim().min(1, "请先扫描二维码或输入参与者编号"),
  mode: z.enum(["qr", "manual", "auto"]).default("auto"),
});

export const participantListQuerySchema = z.object({
  q: z.string().trim().optional().default(""),
  checkInStatus: z
    .enum(["all", "checked_in", "not_checked_in"])
    .optional()
    .default("all"),
  stageStatus: z
    .enum(["all", "NOT_QUEUED", "WAITING", "ON_STAGE", "COMPLETED"])
    .optional()
    .default("all"),
});
