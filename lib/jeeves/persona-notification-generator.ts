/**
 * Jeeves Persona Notification Generator
 *
 * LLM-driven per-persona notification generation:
 * - Reads persona memory and preferences
 * - Decides notification format (dashboard vs text)
 * - Generates custom v0 dashboard if needed
 * - Composes personalized notification
 */

import { generateObject, tool } from 'ai';
import { z } from 'zod';
import { myProvider } from '@/lib/ai/providers';
import { getPersonaMemory, getRecentLogs, appendUserLog } from '@/lib/db/userlog-ops';
import { generateHtmlWithV0 } from '@/lib/v0/client';
import { publishedDashboard } from '@/lib/db/schema';
import { db } from '@/lib/db/queries';
import crypto from 'crypto';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

/**
 * Persona notification result
 */
export interface PersonaNotificationResult {
  personaName: string;
  format: string; // "detailed_dashboard" | "simple_text" | "summary_with_chart"
  dashboardUrl?: string;
  dashboardId?: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  summaryOneLiner: string;
}

/**
 * Discovery type for notification generation
 */
interface Discovery {
  id?: string;
  title: string;
  category: string;
  severity: string;
  confidence: number;
  reasoning: string;
  evidence: any;
  hypothesis?: string;
  recommendations?: string[];
}

/**
 * Recipient type
 */
interface Recipient {
  personaName: string;
  reasoning: string;
  // suggestedFormat removed - we decide format based on actual persona preferences
}

/**
 * Generate persona-specific notification with LLM decision-making
 */
export async function generatePersonaNotification(
  discovery: Discovery,
  recipient: Recipient
): Promise<PersonaNotificationResult> {
  console.log(`[Persona Notification] ========================================`);
  console.log(`[Persona Notification] Generating for: ${recipient.personaName}`);
  console.log(`[Persona Notification] Discovery: ${discovery.title}`);
  console.log(`[Persona Notification] Why this person: ${recipient.reasoning}`);

  try {
    // Load persona context
    const [memory, recentLogs] = await Promise.all([
      getPersonaMemory(recipient.personaName).catch(() => null),
      getRecentLogs(recipient.personaName, 20).catch(() => [])
    ]);

    console.log(`[Persona Notification] Persona memory found:`, !!memory);
    console.log(`[Persona Notification] Recent logs count:`, recentLogs.length);

    const personaContext = buildPersonaContext(memory, recentLogs);

    // Define notification decision schema
    const NotificationDecisionSchema = z.object({
      decision: z.enum(['detailed_dashboard', 'simple_text', 'summary_with_chart']).describe(
        'Based on persona preferences, should we generate a detailed dashboard, simple text, or summary with embedded chart?'
      ),
      reasoning: z.string().describe('Why this format was chosen for this persona'),
      dashboardPrompt: z.string().optional().describe(
        'If decision is detailed_dashboard or summary_with_chart, provide v0 prompt for dashboard generation'
      ),
      format: z.enum(['executive', 'technical', 'brief', 'detailed']).describe(
        'Communication format for this persona'
      ),
      subject: z.string().describe('Email subject line'),
      oneLiner: z.string().describe('One sentence summary for notification badge'),
      bodyText: z.string().describe('Plain text version (2-5 sentences)'),
    });

    // System prompt for LLM decision
    const systemPrompt = `
You are Jeeves, the AI butler. You are composing a personalized notification for ${recipient.personaName}.

DISCOVERY DETAILS:
Title: ${discovery.title}
Category: ${discovery.category}
Severity: ${discovery.severity}
Confidence: ${(discovery.confidence * 100).toFixed(0)}%
Reasoning: ${discovery.reasoning}
Hypothesis: ${discovery.hypothesis || 'N/A'}
Evidence: ${JSON.stringify(discovery.evidence || {}).substring(0, 1000)}
${discovery.recommendations ? `Recommendations: ${discovery.recommendations.join('; ')}` : ''}

RECIPIENT PROFILE:
${personaContext}

WHY THIS MATTERS TO THEM:
${recipient.reasoning}

YOUR TASK:
Based on this persona's ACTUAL communication preferences and history, decide the BEST notification format.

You have complete autonomy - no format has been pre-suggested. Decide based purely on:
- This persona's recorded preferences
- Their recent interaction patterns
- The discovery's severity and complexity
- What would genuinely be most useful for THEM

DECISION RULES:
1. Read persona memory carefully - if they prefer "brief updates", choose simple_text
2. If they previously asked for "detailed reports" or "dashboards", choose detailed_dashboard
3. For technical personas (engineers, analysts), consider detailed_dashboard
4. For executives/busy people, prefer simple_text unless high severity
5. If severity is "critical" or "high", consider adding dashboard even for brief-preferring personas
6. When in doubt, err on the side of their stated preferences

OUTPUT:
Return your decision with clear reasoning.
`.trim();

    console.log(`[Persona Notification] Calling LLM for decision...`);

    const result = await generateObject({
      model: myProvider.languageModel('chat-model'),
      schema: NotificationDecisionSchema,
      system: systemPrompt,
      prompt: `Analyze the persona profile and decide the best notification format. Return your decision in the specified JSON schema.`,
      temperature: 0.7,
    });

    const decision = result.object;
    console.log(`[Persona Notification] LLM Decision:`, decision.decision);
    console.log(`[Persona Notification] Format:`, decision.format);
    console.log(`[Persona Notification] Reasoning:`, decision.reasoning);

    // Generate dashboard if needed
    let dashboardUrl: string | undefined;
    let dashboardId: string | undefined;

    if (decision.decision === 'detailed_dashboard' || decision.decision === 'summary_with_chart') {
      if (!decision.dashboardPrompt) {
        console.warn(`[Persona Notification] Decision was ${decision.decision} but no dashboardPrompt provided. Falling back to simple_text.`);
      } else {
        console.log(`[Persona Notification] 🎨 Generating v0 dashboard...`);
        console.log(`[Persona Notification] Dashboard prompt:`, decision.dashboardPrompt.substring(0, 200));

        try {
          const dashboardResult = await generateV0Dashboard(
            decision.dashboardPrompt,
            discovery,
            recipient.personaName
          );

          dashboardUrl = dashboardResult.dashboardUrl;
          dashboardId = dashboardResult.dashboardId;

          console.log(`[Persona Notification] ✅ Dashboard generated:`, dashboardUrl);

          // Log preference for future learning
          await appendUserLog({
            personaName: recipient.personaName,
            kind: 'preference',
            content: `Sent detailed dashboard for ${discovery.severity} severity discovery`,
            meta: { discoveryId: discovery.id, format: decision.decision }
          }).catch(err => console.warn('[Persona Notification] Failed to log preference:', err));

        } catch (dashboardError: any) {
          console.error(`[Persona Notification] ❌ Dashboard generation failed:`, dashboardError.message);
          console.log(`[Persona Notification] Falling back to text-only notification`);
        }
      }
    } else {
      console.log(`[Persona Notification] ℹ️ Text-only notification (no dashboard)`);

      // Log preference for text
      await appendUserLog({
        personaName: recipient.personaName,
        kind: 'preference',
        content: `Sent text-only notification for ${discovery.severity} severity discovery`,
        meta: { discoveryId: discovery.id, format: 'simple_text' }
      }).catch(err => console.warn('[Persona Notification] Failed to log preference:', err));
    }

    // Build final HTML
    const bodyHtml = buildNotificationHtml(
      decision.bodyText,
      dashboardUrl,
      discovery,
      decision.format
    );

    console.log(`[Persona Notification] ✅ Notification complete for ${recipient.personaName}`);
    console.log(`[Persona Notification] Dashboard included:`, !!dashboardUrl);
    console.log(`[Persona Notification] ========================================`);

    return {
      personaName: recipient.personaName,
      format: decision.format,
      dashboardUrl,
      dashboardId,
      subject: decision.subject,
      bodyHtml,
      bodyText: decision.bodyText,
      summaryOneLiner: decision.oneLiner,
    };

  } catch (error: any) {
    console.error(`[Persona Notification] ========================================`);
    console.error(`[Persona Notification] ❌ FATAL ERROR for ${recipient.personaName}`);
    console.error(`[Persona Notification] Error:`, error.message);
    console.error(`[Persona Notification] Stack:`, error.stack);
    console.error(`[Persona Notification] ========================================`);

    // Fallback notification
    return {
      personaName: recipient.personaName,
      format: 'brief',
      subject: `🎩 Jeeves Alert: ${discovery.title}`,
      bodyHtml: `<p>${discovery.reasoning}</p>`,
      bodyText: discovery.reasoning,
      summaryOneLiner: discovery.title,
    };
  }
}

/**
 * Build persona context from memory and logs
 */
function buildPersonaContext(memory: any, recentLogs: any[]): string {
  const lines: string[] = [];

  if (memory?.summary) {
    lines.push(`Memory Summary:\n${memory.summary}`);
  }

  const traits = memory?.traits || {};
  if (traits.interests?.length > 0) {
    lines.push(`\nInterests: ${traits.interests.join(', ')}`);
  }

  // Extract communication preferences
  const prefLogs = recentLogs.filter(log => log.kind === 'preference');
  if (prefLogs.length > 0) {
    lines.push(`\nRecent Preferences:`);
    prefLogs.slice(0, 5).forEach(log => {
      lines.push(`- ${log.content}`);
    });
  }

  // Look for "brief" vs "detailed" preferences
  const hasBriefPref = recentLogs.some(log =>
    log.content.toLowerCase().includes('brief') ||
    log.content.toLowerCase().includes('concise') ||
    log.content.toLowerCase().includes('short') ||
    log.content.toLowerCase().includes('summary')
  );

  const hasDetailedPref = recentLogs.some(log =>
    log.content.toLowerCase().includes('detailed') ||
    log.content.toLowerCase().includes('comprehensive') ||
    log.content.toLowerCase().includes('in-depth') ||
    log.content.toLowerCase().includes('dashboard') ||
    log.content.toLowerCase().includes('visual')
  );

  if (hasBriefPref) {
    lines.push(`\n⚠️ IMPORTANT: User prefers BRIEF, CONCISE updates`);
  }

  if (hasDetailedPref) {
    lines.push(`\n⚠️ IMPORTANT: User prefers DETAILED, COMPREHENSIVE reports with visuals`);
  }

  if (lines.length === 0) {
    return 'No persona memory or preferences recorded yet.';
  }

  return lines.join('\n');
}

/**
 * Generate v0 dashboard and publish it
 */
async function generateV0Dashboard(
  prompt: string,
  discovery: Discovery,
  personaName: string
): Promise<{ dashboardUrl: string; dashboardId: string; html: string }> {
  console.log(`[V0 Dashboard] Generating for persona: ${personaName}`);

  // Enhance prompt with discovery context
  const enhancedPrompt = `
${prompt}

DISCOVERY CONTEXT:
- Title: ${discovery.title}
- Severity: ${discovery.severity}
- Confidence: ${(discovery.confidence * 100).toFixed(0)}%
- Category: ${discovery.category}

Requirements:
- Self-contained HTML with inline CSS
- Include data-slot-id attributes for dynamic content:
  * data-slot-id="live-chart" for chart area
  * data-slot-id="current-value" for current readings
  * data-slot-id="status" for real-time status
  * data-slot-id="timestamp" for last update time
- Color scheme based on severity:
  * critical: red theme (#dc2626)
  * high: orange theme (#ea580c)
  * normal: blue theme (#2563eb)
  * low: green theme (#16a34a)
- Modern design with gradients, shadows, rounded corners
- Responsive and professional

Make it IMPRESSIVE!
`.trim();

  // Call v0 API
  const { html } = await generateHtmlWithV0({ prompt: enhancedPrompt });
  console.log(`[V0 Dashboard] HTML generated, length:`, html.length);

  // Generate IDs
  const cardId = crypto.randomUUID();
  const slug = generateSlug(`${personaName}-${discovery.title}`);
  const accessToken = generateAccessToken();

  // Generate dashboard script
  // Use real FCU-01_04 streams from evidence, or default to spacetemp if missing
  const streams = discovery.evidence?.streams || ['fcu-01_04-spacetemp'];
  const script = generateDashboardScript(cardId, streams, discovery);

  // Publish to database
  const baseUrl = process.env.NEXT_PUBLIC_URL ||
                 (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const dashboardUrl = `${baseUrl}/d/${slug}`;

  console.log(`[V0 Dashboard] Publishing to database...`);
  console.log(`[V0 Dashboard] Slug:`, slug);
  console.log(`[V0 Dashboard] URL:`, dashboardUrl);

  const client = postgres(process.env.POSTGRES_URL!);
  const dbConn = drizzle(client);

  const [dashboard] = await dbConn.insert(publishedDashboard).values({
    userId: '00000000-0000-0000-0000-000000000000', // System user for Jeeves
    chatId: null,
    title: `${personaName}: ${discovery.title}`,
    description: `Persona-specific dashboard for ${personaName}`,
    html,
    script,
    cardId,
    slug,
    accessToken,
    password: null,
    expiresAt: null,
    maxViews: null,
    currentViews: '0',
    streams: streams.map((s: string) => ({ id: s, name: s })),
    config: { refreshRate: 1000, theme: 'auto', cardId },
    status: 'active' as const,
  }).returning();

  await client.end();

  console.log(`[V0 Dashboard] ✅ Published successfully`);

  return {
    dashboardUrl,
    dashboardId: dashboard.id,
    html,
  };
}

/**
 * Generate URL-friendly slug
 */
function generateSlug(title: string): string {
  const slugBase = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40);

  const randomSuffix = crypto.randomBytes(4).toString('hex');
  return `${slugBase}-${randomSuffix}`;
}

/**
 * Generate cryptographic access token
 */
function generateAccessToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate JavaScript for live dashboard
 */
function generateDashboardScript(
  cardId: string,
  streams: string[],
  discovery: any
): string {
  return `
// Jeeves Persona Dashboard Script
// Card ID: ${cardId}
// Generated: ${new Date().toISOString()}

console.log('[Dashboard] Initializing persona-specific dashboard...');
console.log('[Dashboard] Streams:', ${JSON.stringify(streams)});

const primaryStream = ${JSON.stringify(streams[0])};
const streamUrl = \`/api/telemetry/stream?streamId=\${primaryStream}&intervalMs=1000\`;

console.log('[Dashboard] Subscribing to:', streamUrl);
api.subscribe(streamUrl);

const dataPoints = [];
const maxPoints = 60;

api.on('tick', (data) => {
  const value = data.value || data.temperature || data.temp || 0;
  const timestamp = new Date(data.timestamp || data.ts || Date.now());

  api.replaceSlot('current-value', value.toFixed(2));
  api.replaceSlot('timestamp', timestamp.toLocaleTimeString());
  api.replaceSlot('status', '🟢 Live');

  dataPoints.push({ time: timestamp, value: value });
  if (dataPoints.length > maxPoints) dataPoints.shift();

  // Don't replace the v0-generated chart - it's already beautiful!
  // The chart in the v0 HTML is static but visually impressive
  // Just update the live data values instead
});

api.on('error', (error) => {
  console.error('[Dashboard] Error:', error);
  api.replaceSlot('status', '🔴 Error');
});

console.log('[Dashboard] Initialization complete');
`.trim();
}

/**
 * Build notification HTML
 */
function buildNotificationHtml(
  bodyText: string,
  dashboardUrl: string | undefined,
  discovery: Discovery,
  format: string
): string {
  return `
<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; padding: 20px; background: #ffffff;">
  <div style="margin-bottom: 20px;">
    <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">
      🎩 Jeeves Discovery
    </div>
    <div style="margin-top: 8px; font-size: 14px; color: #4b5563;">
      ${bodyText.split('\n').map(line => `<p style="margin: 8px 0;">${line}</p>`).join('')}
    </div>
  </div>

  ${dashboardUrl ? `
    <div style="margin: 24px 0; border: 2px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <iframe
        src="${dashboardUrl}"
        width="100%"
        height="400"
        frameborder="0"
        style="display: block;"
      ></iframe>
    </div>
    <div style="text-align: center; margin-top: 16px;">
      <a
        href="${dashboardUrl}"
        target="_blank"
        style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;"
      >
        Open Full Dashboard →
      </a>
    </div>
  ` : ''}

  <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
    <p style="margin: 4px 0;">
      Confidence: ${(discovery.confidence * 100).toFixed(0)}% |
      Severity: ${discovery.severity} |
      Format: ${format}
    </p>
  </div>
</div>
  `.trim();
}
