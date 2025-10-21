/**
 * Inngest Function: Process Notifications
 *
 * Coordinates notification generation by fanning out to individual persona handlers
 */

import { inngest } from "../client";
import { getDiscoveryById, createNotification, addPersonaDashboard, updateDiscoveryStatus, logActivity } from "@/lib/db/jeeves-queries";
import { generatePersonaNotification } from "@/lib/jeeves/persona-notification-generator";
import { db } from "@/lib/db/queries";
import { persona } from "@/lib/db/userlog-schema";
import { eq } from "drizzle-orm";
import { sendNotificationEmail as sendEmail } from "@/lib/email/service";

/**
 * Main coordinator: Fans out to individual persona notification functions
 */
export const processNotifications = inngest.createFunction(
  {
    id: "process-notifications",
    name: "Process Discovery Notifications (Coordinator)",
    retries: 2, // Limit retries to prevent excessive duplicate processing
  },
  { event: "discovery.completed" },
  async ({ event, step }) => {
    const { discoveryId, executionId } = event.data;

    console.log(`[Inngest:Coordinator] Processing discovery ${discoveryId}`);
    await logActivity(executionId, "info", `📬 Starting notification coordination for discovery ${discoveryId}`);

    // Step 1: Load discovery
    const discovery = await step.run("load-discovery", async () => {
      const disc = await getDiscoveryById(discoveryId);
      if (!disc) {
        throw new Error(`Discovery ${discoveryId} not found`);
      }
      return disc;
    });

    const recipients = (discovery.intendedRecipients as any[]) || [];
    console.log(`[Inngest:Coordinator] Found ${recipients.length} recipients`);

    // Step 2: Fan-out to individual persona notification functions
    // Each gets its own 60s execution budget
    await step.run('fan-out-notifications', async () => {
      console.log(`[Inngest:Coordinator] 🎯 Fanning out to ${recipients.length} personas for discovery ${discoveryId}`);
      await logActivity(executionId, "info", `🎯 Fan-out: ${recipients.length} persona events for discovery ${discoveryId}`);

      for (const recipient of recipients) {
        console.log(`[Inngest:Coordinator] 📤 Sending persona.notify event for ${recipient.personaName} (discovery=${discoveryId})`);
        await inngest.send({
          name: "persona.notify",
          id: `persona-${discoveryId}-${recipient.personaName}`, // IDEMPOTENCY: Prevents duplicate processing
          data: {
            discoveryId: discovery.id,
            executionId,
            recipient,
            discovery: {
              id: discovery.id,
              title: discovery.title,
              category: discovery.category || "",
              severity: discovery.severity,
              confidence: parseFloat(discovery.confidence || "0"),
              reasoning: discovery.aiReasoning,
              evidence: discovery.aiEvidence,
              hypothesis: discovery.aiHypothesis || "",
              recommendations: (discovery.aiRecommendations as string[]) || [],
            }
          }
        });
        console.log(`[Inngest:Coordinator] ✅ Event sent: persona.notify (${recipient.personaName}, discovery=${discoveryId})`);
      }

      await logActivity(executionId, "success", `✅ Sent ${recipients.length} persona.notify events for discovery ${discoveryId}`);
      return { sent: recipients.length };
    });

    // Step 3: Log completion
    await step.run("log-fanout", async () => {
      console.log(`[Inngest:Coordinator] ✅ Fanned out ${recipients.length} notifications`);
      await logActivity(executionId, "success", `✅ Fanned out ${recipients.length} persona notifications`);
    });

    return {
      success: true,
      discoveryId,
      totalRecipients: recipients.length,
      status: 'fanned-out'
    };
  }
);

/**
 * Individual persona notification handler
 * Runs independently with 300s timeout for complex dashboard generation
 */
export const processPersonaNotification = inngest.createFunction(
  {
    id: "process-persona-notification",
    name: "Process Single Persona Notification",
    retries: 2, // Limit retries: 1 initial + 2 retries = 3 total attempts
    onFailure: async ({ error, event }) => {
      // Log failure details to Activity Log
      const { executionId, recipient } = event.data.event.data;
      console.error(`[Inngest:Persona] ❌ FINAL FAILURE for ${recipient.personaName}:`, error);
      await logActivity(executionId, "error", `❌ FINAL FAILURE: ${recipient.personaName} - ${error.message}`);
    },
  },
  { event: "persona.notify" },
  async ({ event, step }) => {
    const { discoveryId, executionId, recipient, discovery } = event.data;

    console.log(`[Inngest:Persona] 🎨 STARTING persona notification: ${recipient.personaName} (discovery=${discoveryId}, execution=${executionId})`);
    await logActivity(executionId, "info", `🎨 Processing ${recipient.personaName} (discovery=${discoveryId})`);

    try {
      // Generate notification (LLM + optional dashboard)
      const personaNotif = await step.run("generate-notification", async () => {
        return await generatePersonaNotification(
          {
            id: discovery.id,
            title: discovery.title,
            category: discovery.category,
            severity: discovery.severity,
            confidence: discovery.confidence,
            reasoning: discovery.reasoning,
            evidence: discovery.evidence,
            hypothesis: discovery.hypothesis,
            recommendations: discovery.recommendations,
          },
          recipient
        );
      });

      console.log(`[Inngest:Persona] ✅ Generated for ${recipient.personaName}: format=${personaNotif.format}`);
      await logActivity(executionId, "success", `✅ ${recipient.personaName}: ${personaNotif.format}${personaNotif.dashboardUrl ? ' (with dashboard)' : ''}`);

      // Save notification to database
      const notification = await step.run("save-notification", async () => {
        const newNotif = await createNotification({
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

        return newNotif;
      });

      // Emit event to send email (separate function handles this)
      await step.run("trigger-email", async () => {
        await inngest.send({
          name: "notification.send-email",
          id: `email-${notification.id}`, // IDEMPOTENCY: Prevents duplicate emails
          data: {
            notificationId: notification.id,
            personaName: recipient.personaName,
            subject: personaNotif.subject,
            bodyHtml: personaNotif.bodyHtml,
            bodyText: personaNotif.bodyText,
            executionId,
          }
        });
        console.log(`[Inngest:Persona] 📤 Triggered email event for ${recipient.personaName}`);
      });

      return {
        success: true,
        personaName: recipient.personaName,
        format: personaNotif.format,
        dashboardUrl: personaNotif.dashboardUrl,
      };

    } catch (error: any) {
      console.error(`[Inngest:Persona] ❌ Failed for ${recipient.personaName}:`, error);
      await logActivity(executionId, "error", `❌ ${recipient.personaName}: ${error.message}`);
      throw error; // Inngest will retry
    }
  }
);

/**
 * Send email notification for a saved notification
 * Runs separately after notification is created
 */
export const sendNotificationEmail = inngest.createFunction(
  {
    id: "send-notification-email",
    name: "Send Notification Email",
    retries: 3, // Email can fail due to network - allow more retries
    rateLimit: {
      limit: 2,
      period: "1s", // Respect Resend free tier: 2 requests per second
    },
    onFailure: async ({ error, event }) => {
      // Log email failure
      const { executionId, personaName } = event.data.event.data;
      console.error(`[Email Handler] ❌ FINAL FAILURE for ${personaName}:`, error);
      await logActivity(executionId, "error", `❌ Email FINAL FAILURE: ${personaName} - ${error.message}`);
    },
  },
  { event: "notification.send-email" },
  async ({ event, step }) => {
    const { notificationId, personaName, subject, bodyHtml, bodyText, executionId } = event.data;

    console.log(`[Email Handler] 📧 Processing email for ${personaName}, notification ${notificationId}`);

    try {
      // Get persona email settings
      const personaData = await step.run("get-persona-data", async () => {
        const [data] = await db
          .select()
          .from(persona)
          .where(eq(persona.name, personaName))
          .limit(1);

        console.log(`[Email Handler] 📋 Persona data:`, {
          email: data?.email || 'NOT SET',
          sendNotification: data?.sendNotification ?? 'NOT SET',
          name: data?.name || 'NOT FOUND'
        });

        return data;
      });

      // Check if email should be sent
      if (!personaData) {
        console.error(`[Email Handler] ❌ Persona ${personaName} not found`);
        await logActivity(executionId, "error", `❌ Email skipped: ${personaName} not found`);
        return { skipped: true, reason: "persona_not_found" };
      }

      if (!personaData.email) {
        console.log(`[Email Handler] ⏭️ No email configured for ${personaName}`);
        await logActivity(executionId, "info", `⏭️ Email skipped: ${personaName} has no email`);
        return { skipped: true, reason: "no_email" };
      }

      if (!personaData.sendNotification) {
        console.log(`[Email Handler] ⏭️ Notifications disabled for ${personaName}`);
        await logActivity(executionId, "info", `⏭️ Email skipped: ${personaName} disabled notifications`);
        return { skipped: true, reason: "notifications_disabled" };
      }

      // Send the email
      const emailSent = await step.run("send-email", async () => {
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : process.env.NEXT_PUBLIC_APP_URL || 'https://yourapp.vercel.app';
        const notificationUrl = `${baseUrl}/jeeves#notification-${notificationId}`;

        console.log(`[Email Handler] 📬 Sending to ${personaData.email}`);

        return await sendEmail({
          to: personaData.email!, // We already checked it exists above
          personaName: personaData.name,
          subject,
          bodyHtml,
          bodyText,
          notificationUrl,
        });
      });

      if (emailSent) {
        console.log(`[Email Handler] ✅ Email sent to ${personaData.email}`);
        await logActivity(executionId, "success", `📧 Email sent to ${personaData.name} (${personaData.email})`);
        return { sent: true, email: personaData.email };
      } else {
        console.error(`[Email Handler] ❌ Email failed for ${personaData.email}`);
        await logActivity(executionId, "error", `❌ Email failed for ${personaData.name} (${personaData.email})`);
        return { sent: false, email: personaData.email };
      }

    } catch (error: any) {
      console.error(`[Email Handler] ❌ Exception:`, error);
      await logActivity(executionId, "error", `❌ Email exception for ${personaName}: ${error.message}`);
      throw error; // Inngest will retry
    }
  }
);
