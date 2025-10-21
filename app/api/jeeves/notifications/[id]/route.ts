/**
 * Delete Notification API
 * Deletes a specific notification by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/queries';
import { jeevesNotification } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: notificationId } = await params;

    // Delete the notification
    const result = await db
      .delete(jeevesNotification)
      .where(eq(jeevesNotification.id, notificationId))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error: any) {
    console.error('[Delete Notification] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification', message: error.message },
      { status: 500 }
    );
  }
}
