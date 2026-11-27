import { NextResponse } from "next/server";
import { requireStaffOrAdmin } from "@/lib/session";

export async function GET(request: Request) {
  const authResult = await requireStaffOrAdmin(request.headers);
  if (!authResult.ok) {
    return authResult.response;
  }
  return NextResponse.json({ user: authResult.actor });
}
