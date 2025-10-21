import { NextResponse } from "next/server";
import { getPersonaMemory } from "@/lib/db/userlog-ops";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  try {
    const memory = await getPersonaMemory(decodeURIComponent(name));

    return NextResponse.json({
      memory,
    });
  } catch (error) {
    console.error("Failed to get persona memory:", error);
    return NextResponse.json(
      { error: "Failed to get persona memory" },
      { status: 500 }
    );
  }
}
