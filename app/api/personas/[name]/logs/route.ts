import { NextResponse } from "next/server";
import { getRecentLogs } from "@/lib/db/userlog-ops";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  try {
    const logs = await getRecentLogs(decodeURIComponent(name), 50);

    return NextResponse.json({
      logs,
    });
  } catch (error) {
    console.error("Failed to get persona logs:", error);
    return NextResponse.json(
      { error: "Failed to get persona logs" },
      { status: 500 }
    );
  }
}
