/**
 * Jeeves Notification Processor
 *
 * Processes notifications for a specific discovery
 * Called by orchestrator after discovery completes
 */

import { NextResponse } from "next/server";
import { getDiscoveryById } from "@/lib/db/jeeves-queries";
import { generatePersonaNotification } from "@/lib/jeeves/persona-notification-generator";
import { createNotification, addPersonaDashboard, updateDiscoveryStatus, logActivity } from "@/lib/db/jeeves-queries";

export const maxDuration = 300; // 5 minutes per notification batch
export const runtime = 'nodejs'; // Ensure Node.js runtime for database operations

interface NotificationRequest {
  discoveryId: string;
  executionId: string;
}

// GET handler for health check / debugging
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/jeeves/process-notifications',
    methods: ['POST'],
    description: 'Processes notifications for a discovery'
  });
}

export async function POST(request: Request) {
  try {
    const body: NotificationRequest = await request.json();
    const { discoveryId, executionId } = body;

    console.log(`[Notification Processor] Processing notifications for discovery ${discoveryId}`);
    await logActivity(executionId, "info", `📬 Starting notification generation for discovery ${discoveryId}`);

    // Get discovery from database
    const discovery = await getDiscoveryById(discoveryId);
    if (!discovery) {
      throw new Error(`Discovery ${discoveryId} not found`);
    }

    const recipients = (discovery.intendedRecipients as any[]) || [];
    console.log(`[Notification Processor] Found ${recipients.length} recipients`);

    let successCount = 0;
    const errors: string[] = [];

    // Process each recipient sequentially
    for (const recipient of recipients) {
      try {
        console.log(`[Notification Processor] 🎨 Processing ${recipient.personaName}`);
        await logActivity(executionId, "info", `🎨 Processing ${recipient.personaName}`);

        const personaNotif = await generatePersonaNotification(
          {
            id: discovery.id,
            title: discovery.title,
            category: discovery.category || "",
            severity: discovery.severity,
            confidence: parseFloat(discovery.confidence || "0"),
            reasoning: discovery.aiReasoning,
            evidence: discovery.aiEvidence,
            hypothesis: discovery.aiHypothesis || "",
            recommendations: (discovery.aiRecommendations as string[]) || [],
          },
          recipient
        );

        console.log(`[Notification Processor] ✅ Generated for ${recipient.personaName}: format=${personaNotif.format}`);
        await logActivity(executionId, "success", `✅ ${recipient.personaName}: ${personaNotif.format}${personaNotif.dashboardUrl ? ' (with dashboard)' : ''}`);

        // Save notification
        await createNotification({
          discoveryId: discovery.id,
          personaName: personaNotif.personaName,
          format: personaNotif.format,
          subject: personaNotif.subject,
          bodyHtml: personaNotif.bodyHtml,
          bodyText: personaNotif.bodyText,
          summaryOneLiner: personaNotif.summaryOneLiner,
          embedDashboardUrl: personaNotif.dashboardUrl || null,
          embedChartImages: null,
          embedDataTable: null,
          viewedAt: null,
          acknowledgedAt: null,
          feedback: null,
        });

        // Track dashboard if generated
        if (personaNotif.dashboardId && personaNotif.dashboardUrl) {
          await addPersonaDashboard(discovery.id, {
            personaName: recipient.personaName,
            dashboardId: personaNotif.dashboardId,
            dashboardUrl: personaNotif.dashboardUrl,
            format: personaNotif.format,
          });
        }

        successCount++;
      } catch (error: any) {
        console.error(`[Notification Processor] ❌ Failed for ${recipient.personaName}:`, error);
        await logActivity(executionId, "error", `❌ ${recipient.personaName}: ${error.message}`);
        errors.push(`${recipient.personaName}: ${error.message}`);
      }
    }

    console.log(`[Notification Processor] ✅ Completed ${successCount}/${recipients.length} notifications`);
    await logActivity(executionId, "success", `✅ Completed ${successCount}/${recipients.length} notifications`);

    // Mark discovery as notified
    await updateDiscoveryStatus(discovery.id, "notified");

    return NextResponse.json({
      success: true,
      discoveryId,
      totalRecipients: recipients.length,
      successCount,
      errors,
    });

  } catch (error: any) {
    console.error("[Notification Processor] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
