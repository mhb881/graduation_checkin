import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export type AppRole = "admin" | "staff";

export interface AuthenticatedActor {
  id: string;
  name: string;
  email: string;
  role: AppRole;
}

export function normalizeRole(role: string | null | undefined): AppRole {
  return role === "admin" ? "admin" : "staff";
}

export async function getServerSessionActor(
  reqHeaders?: Headers
): Promise<AuthenticatedActor | null> {
  const hdrs = reqHeaders ?? (await headers());
  const session = await auth.api.getSession({
    headers: hdrs,
  });

  if (!session?.user) {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: normalizeRole((session.user as { role?: string | null }).role),
  };
}

export async function requireStaffOrAdmin(
  reqHeaders?: Headers
): Promise<
  | { ok: true; actor: AuthenticatedActor }
  | { ok: false; response: NextResponse }
> {
  const actor = await getServerSessionActor(reqHeaders);
  if (!actor) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "UNAUTHORIZED", message: "请先登录后再操作" },
        { status: 401 }
      ),
    };
  }
  return { ok: true, actor };
}

export async function requireAdmin(
  reqHeaders?: Headers
): Promise<
  | { ok: true; actor: AuthenticatedActor }
  | { ok: false; response: NextResponse }
> {
  const authResult = await requireStaffOrAdmin(reqHeaders);
  if (!authResult.ok) {
    return authResult;
  }
  if (authResult.actor.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "FORBIDDEN", message: "仅管理员可执行此操作" },
        { status: 403 }
      ),
    };
  }
  return authResult;
}
