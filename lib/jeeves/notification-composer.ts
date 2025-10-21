/**
 * Jeeves Notification Composer
 *
 * Generates personalized notifications for each persona
 * based on their interests, behavior, and communication style
 */

import { generateText } from "ai";
import { myProvider } from "@/lib/ai/providers";
import { getPersonaMemory, getRecentLogs } from "@/lib/db/userlog-ops";
import type { PersonaContext } from "./discovery-engine";
import type { VisualReport } from "./visual-report-generator";

/**
 * Personalized notification
 */
export interface PersonalizedNotification {
  personaName: string;
  format: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  summaryOneLiner: string;
  embedDashboardUrl: string;
}

/**
 * Compose personalized notification for a specific persona
 */
export async function composeNotification(
  discovery: any,
  recipient: { personaName: string; reasoning: string; suggestedFormat: string },
  visualReport: VisualReport
): Promise<PersonalizedNotification> {
  console.log("[Jeeves Notification] Composing for:", recipient.personaName);

  try {
    // Load persona context
    const memory = await getPersonaMemory(recipient.personaName);
    const recentLogs = await getRecentLogs(recipient.personaName, 10);

    const traits = (memory?.traits as any) || {};
    const personaContext = {
      personaName: recipient.personaName,
      memory,
      recentLogs,
      interests: (traits.interests as string[]) || [],
      behaviorPatterns: traits.behaviorPatterns || {},
    };

    // Generate personalized notification content
    const prompt = `
You are Jeeves, crafting a personalized notification for ${recipient.personaName}.

DISCOVERY:
Title: ${discovery.title}
Category: ${discovery.category}
Severity: ${discovery.severity}
Reasoning: ${discovery.reasoning}
Evidence: ${JSON.stringify(discovery.evidence).substring(0, 500)}
Hypothesis: ${discovery.hypothesis || 'N/A'}

RECIPIENT PROFILE:
Persona: ${recipient.personaName}
Interests: ${personaContext.interests.join(', ') || 'Unknown'}
Recent activity: ${recentLogs.length} interactions
Memory: ${memory?.summary || 'No memory yet'}
Behavior patterns: ${JSON.stringify(personaContext.behaviorPatterns)}

WHY THIS PERSON: ${recipient.reasoning}
SUGGESTED FORMAT: ${recipient.suggestedFormat}

LIVE DASHBOARD: ${visualReport.dashboardUrl}

YOUR TASK:
Compose the PERFECT notification for THIS specific person.

Guidelines:
1. Match their communication style (technical? brief? detailed?)
2. Highlight what THEY care about (based on interests)
3. Use appropriate tone and language level
4. Include the live dashboard link prominently
5. Make subject line attention-grabbing but relevant

OUTPUT FORMAT (JSON):
{
  "format": "brief|detailed|technical|executive|visual",
  "subject": "Eye-catching subject line",
  "oneLiner": "One sentence summary for notification badge",
  "bodyText": "Plain text version (2-3 sentences)",
  "bodyHtml": "Rich HTML body with embedded dashboard iframe"
}

EXAMPLES:

For technical user:
{
  "format": "technical",
  "subject": "Detected: Harmonic resonance pattern (σ=3.2)",
  "oneLiner": "Temperature oscillation with 7.3min period discovered",
  "bodyText": "Detected synchronized oscillation across streams with 0.94 correlation (p<0.001). Period: 7.3 minutes. Confidence: 89%.",
  "bodyHtml": "<div><h3>Technical Analysis</h3><p>Detected synchronized oscillation with...</p><iframe src='...' /></div>"
}

For busy operations user:
{
  "format": "brief",
  "subject": "⚠️ Temp spike detected",
  "oneLiner": "Temperature hit 52°C, back to normal",
  "bodyText": "Temp spike at 14:23. Already resolved. Check dashboard for details.",
  "bodyHtml": "<div><p>🔥 Temp spike at 14:23</p><p>Status: Resolved</p><a href='...'>View Dashboard</a></div>"
}

Create notification now:
`;

    const result = await generateText({
      model: myProvider.languageModel('chat-model'),
      prompt,
      temperature: 0.7,
    });

    console.log("[Jeeves Notification] Generated:", result.text.substring(0, 200));

    // Parse the JSON response
    let notificationData: any;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        notificationData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseErr) {
      console.warn("[Jeeves Notification] Failed to parse JSON, using fallback");
      notificationData = {
        format: recipient.suggestedFormat || "standard",
        subject: discovery.title,
        oneLiner: discovery.title,
        bodyText: discovery.reasoning,
        bodyHtml: `<p>${discovery.reasoning}</p>`,
      };
    }

    // Build final HTML with embedded dashboard
    const finalHtml = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0; padding: 20px;">
        ${notificationData.bodyHtml || `<p>${notificationData.bodyText}</p>`}

        <div style="margin: 24px 0; border: 2px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <iframe
            src="${visualReport.dashboardUrl}"
            width="100%"
            height="400"
            frameborder="0"
            style="display: block;"
          ></iframe>
        </div>

        <div style="margin-top: 20px; text-align: center;">
          <a
            href="${visualReport.dashboardUrl}"
            target="_blank"
            style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;"
          >
            Open Full Dashboard →
          </a>
        </div>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
          <p>🎩 Discovered by Jeeves AI Butler</p>
          <p>Confidence: ${(discovery.confidence * 100).toFixed(0)}% | Severity: ${discovery.severity}</p>
        </div>
      </div>
    `;

    return {
      personaName: recipient.personaName,
      format: notificationData.format,
      subject: notificationData.subject,
      bodyHtml: finalHtml,
      bodyText: notificationData.bodyText || discovery.reasoning,
      summaryOneLiner: notificationData.oneLiner || discovery.title,
      embedDashboardUrl: visualReport.dashboardUrl,
    };

  } catch (error) {
    console.error("[Jeeves Notification] Failed to compose:", error);

    // Fallback notification
    return {
      personaName: recipient.personaName,
      format: "standard",
      subject: discovery.title,
      bodyHtml: `<p>${discovery.reasoning}</p><p><a href="${visualReport.dashboardUrl}">View Dashboard</a></p>`,
      bodyText: discovery.reasoning,
      summaryOneLiner: discovery.title,
      embedDashboardUrl: visualReport.dashboardUrl,
    };
  }
}
