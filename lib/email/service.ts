/**
 * Email Service for Jeeves Notifications
 *
 * Sends email notifications to team members when discoveries are published
 */

import "server-only";

interface SendNotificationEmailParams {
  to: string;
  personaName: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  notificationUrl: string;
}

/**
 * Send notification email to persona
 */
export async function sendNotificationEmail({
  to,
  personaName,
  subject,
  bodyHtml,
  bodyText,
  notificationUrl,
}: SendNotificationEmailParams): Promise<boolean> {

  console.log(`[Email] 📧 Attempting to send email to ${to} for ${personaName}`);
  console.log(`[Email] Subject: ${subject}`);
  console.log(`[Email] Notification URL: ${notificationUrl}`);

  // Check if Resend is configured
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.error("[Email] ❌ RESEND_API_KEY not configured - skipping email send");
    return false;
  }

  console.log("[Email] ✅ RESEND_API_KEY is configured");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM
          ? `Jeeves <${process.env.EMAIL_FROM}>`
          : "Jeeves <onboarding@resend.dev>",
        to: [to],
        subject: `[Jeeves] ${subject}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0; color: #111827;">🎩 Jeeves Alert for ${personaName}</h2>
            </div>

            <div style="padding: 20px;">
              ${bodyHtml}
            </div>

            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-top: 20px; text-align: center;">
              <a href="${notificationUrl}"
                 style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                View Full Notification
              </a>
            </div>

            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
              <p>You're receiving this because notifications are enabled for your persona.</p>
              <p>Visit the Jeeves Console to manage your notification preferences.</p>
            </div>
          </div>
        `,
        text: bodyText || `
${subject}

${bodyHtml.replace(/<[^>]*>/g, '')}

View full notification: ${notificationUrl}

---
You're receiving this because notifications are enabled for your persona.
Visit the Jeeves Console to manage your notification preferences.
        `.trim(),
      }),
    });

    console.log(`[Email] Response status: ${response.status}`);

    if (!response.ok) {
      const error = await response.text();
      console.error("[Email] ❌ Failed to send - Status:", response.status);
      console.error("[Email] ❌ Error details:", error);
      return false;
    }

    const data = await response.json();
    console.log("[Email] ✅ Successfully sent to", to, "- Email ID:", data.id);
    return true;

  } catch (error) {
    console.error("[Email] ❌ Exception sending notification email:", error);
    if (error instanceof Error) {
      console.error("[Email] ❌ Error message:", error.message);
      console.error("[Email] ❌ Error stack:", error.stack);
    }
    return false;
  }
}
