import { NextResponse } from "next/server";
import { db } from "@/db";
import { handleApiError } from "@/lib/api-utils";
import {
  getDashboardStats,
  listRecentAuditLogs,
} from "@/lib/graduation-service";
import { requireStaffOrAdmin } from "@/lib/session";

export async function GET(request: Request) {
  const authResult = await requireStaffOrAdmin(request.headers);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const [stats, recentLogs] = await Promise.all([
      getDashboardStats(db),
      listRecentAuditLogs(db, 15),
    ]);

    return NextResponse.json({ stats, recentLogs });
  } catch (err) {
    return handleApiError(err);
  }
}
