import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ServiceError } from "@/lib/graduation-service";

export function handleApiError(err: unknown): NextResponse {
  if (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    (err as { digest?: unknown }).digest === "NEXT_PRERENDER_INTERRUPTED"
  ) {
    throw err;
  }

  if (err instanceof ServiceError) {
    return NextResponse.json(
      {
        error: err.code,
        message: err.message,
        ...(err.data ?? {}),
      },
      { status: err.status }
    );
  }

  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        message: firstIssue?.message ?? "请求参数格式不正确",
        issues: err.issues,
      },
      { status: 400 }
    );
  }

  console.error("Unhandled API error:", err);
  return NextResponse.json(
    {
      error: "INTERNAL_SERVER_ERROR",
      message: "服务器处理请求时发生异常，请稍后重试",
    },
    { status: 500 }
  );
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ServiceError(400, "INVALID_JSON", "请求体必须为合法的 JSON 格式");
  }
}
