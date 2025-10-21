import { NextResponse } from "next/server";
import { db } from "@/lib/db/queries";
import { persona } from "@/lib/db/userlog-schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  try {
    const body = await request.json();
    const { email, sendNotification } = body;

    const updateData: Partial<{ email: string | null; sendNotification: boolean; updatedAt: Date }> = {
      updatedAt: new Date(),
    };

    if (email !== undefined) {
      updateData.email = email || null;
    }

    if (sendNotification !== undefined) {
      updateData.sendNotification = sendNotification;
    }

    await db
      .update(persona)
      .set(updateData)
      .where(eq(persona.name, decodeURIComponent(name)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update persona:", error);
    return NextResponse.json(
      { error: "Failed to update persona" },
      { status: 500 }
    );
  }
}
