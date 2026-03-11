import { NextRequest, NextResponse } from "next/server";
import { getAdminContext, hasPermission } from "@/lib/admin/permissions";
import { getExportJobContent } from "@/lib/admin/services/exports";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminContext();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(admin, "exports.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const job = await getExportJobContent(id);
  if (!job || job.status !== "completed" || !job.content) {
    return NextResponse.json({ error: "Export not ready" }, { status: 404 });
  }

  if (job.expires_at && Date.parse(job.expires_at) <= Date.now()) {
    return NextResponse.json({ error: "Export expired" }, { status: 410 });
  }

  return new NextResponse(job.content, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${job.file_name ?? "export.csv"}"`,
      "Cache-Control": "no-store",
    },
  });
}
