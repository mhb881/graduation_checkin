import crypto from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";

const qrPayloadSchema = z.object({
  v: z.literal(1),
  code: z.string().trim().min(2).max(32),
  sig: z.string().length(16),
});

const participantCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, "编号仅支持字母、数字、连字符和下划线");

function getSigningSecret(): string {
  return process.env.QR_SIGNING_SECRET ?? "grad-qr-hmac-2026-secret-key";
}

export function signParticipantCode(code: string): string {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(`v1:${code.trim().toUpperCase()}`)
    .digest("hex")
    .slice(0, 16);
}

export function buildQrPayload(code: string): string {
  const normalized = code.trim().toUpperCase();
  return JSON.stringify({
    v: 1,
    code: normalized,
    sig: signParticipantCode(normalized),
  });
}

export async function generateQrDataUrl(code: string): Promise<string> {
  const payload = buildQrPayload(code);
  return QRCode.toDataURL(payload, {
    width: 320,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}

export async function generateQrSvg(code: string): Promise<string> {
  const payload = buildQrPayload(code);
  return QRCode.toString(payload, {
    type: "svg",
    margin: 2,
    errorCorrectionLevel: "M",
  });
}

export type ParsedLookupResult =
  | { ok: true; code: string; mode: "qr" | "manual" }
  | {
      ok: false;
      errorCode: "INVALID_QR_FORMAT" | "INVALID_QR_SIGNATURE" | "INVALID_CODE";
      message: string;
    };

/**
 * 解析扫码原始内容或手动输入的参与者编号。
 * - mode = "qr": 严格校验 JSON 结构与 HMAC 签名，防止无效/伪造二维码。
 * - mode = "manual": 支持直接输入唯一编号（如 GRAD-2026-001）。
 */
export function parseParticipantLookupInput(
  rawInput: string,
  mode: "qr" | "manual" | "auto" = "auto"
): ParsedLookupResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      ok: false,
      errorCode: mode === "manual" ? "INVALID_CODE" : "INVALID_QR_FORMAT",
      message: mode === "manual" ? "请输入参与者编号" : "二维码内容为空",
    };
  }

  const looksLikeJson = trimmed.startsWith("{") || mode === "qr";
  if (looksLikeJson) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(trimmed);
    } catch {
      return {
        ok: false,
        errorCode: "INVALID_QR_FORMAT",
        message: "无效二维码：无法识别的二维码格式，请确认扫描的是本场毕业典礼专属二维码",
      };
    }

    const validated = qrPayloadSchema.safeParse(parsedJson);
    if (!validated.success) {
      return {
        ok: false,
        errorCode: "INVALID_QR_FORMAT",
        message: "无效二维码：缺少有效的参与者编号或签名信息",
      };
    }

    const normalizedCode = validated.data.code.toUpperCase();
    const expectedSig = signParticipantCode(normalizedCode);
    const actualBuf = Buffer.from(validated.data.sig, "utf8");
    const expectedBuf = Buffer.from(expectedSig, "utf8");

    if (
      actualBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(actualBuf, expectedBuf)
    ) {
      return {
        ok: false,
        errorCode: "INVALID_QR_SIGNATURE",
        message: "无效二维码：签名校验失败，请核对是否为本系统签发的二维码",
      };
    }

    return { ok: true, code: normalizedCode, mode: "qr" };
  }

  const codeParsed = participantCodeSchema.safeParse(trimmed);
  if (!codeParsed.success) {
    return {
      ok: false,
      errorCode: "INVALID_CODE",
      message: "参与者编号格式不正确（仅支持字母、数字、- 和 _）",
    };
  }

  return {
    ok: true,
    code: codeParsed.data.toUpperCase(),
    mode: "manual",
  };
}
