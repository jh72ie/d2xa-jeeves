/**
 * Jeeves Visual Report Generator
 *
 * Automatically generates stunning live dashboards for each discovery
 * using v0Card + claudeCode + publishDashboard pipeline
 */

import { generateHtmlWithV0 } from "@/lib/v0/client";
import { db } from "@/lib/db/queries";
import { publishedDashboard } from "@/lib/db/schema";
import crypto from "crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

/**
 * Visual report result
 */
export interface VisualReport {
  dashboardId: string;
  dashboardSlug: string;
  dashboardUrl: string;
  html: string;
  script: string;
  cardId: string;
}

/**
 * Generate a URL-friendly slug from title
 */
function generateSlug(title: string): string {
  const slugBase = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30);

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
 * Generate impressive visual dashboard for a discovery
 */
export async function generateVisualReport(discovery: {
  title: string;
  category: string;
  reasoning: string;
  evidence: any;
  hypothesis?: string;
  severity: string;
  confidence: number;
}): Promise<VisualReport> {
  console.log("[Visual Report] ========================================");
  console.log("[Visual Report] Starting dashboard generation");
  console.log("[Visual Report] Discovery title:", discovery.title);
  console.log("[Visual Report] Category:", discovery.category);
  console.log("[Visual Report] Severity:", discovery.severity);
  console.log("[Visual Report] Confidence:", discovery.confidence);

  try {
    // Step 1: Create v0 prompt for stunning dashboard
    const v0Prompt = `
Create a STUNNING, PROFESSIONAL live dashboard for this discovery:

Title: "${discovery.title}"
Category: ${discovery.category}
Severity: ${discovery.severity}
Confidence: ${(discovery.confidence * 100).toFixed(0)}%

Requirements:
- Eye-catching gradient header with title
- Large confidence score badge (color-coded: green=high, yellow=medium, red=low)
- Severity indicator with icon
- Key metrics section with large numbers
- Real-time chart area (will be filled by live data)
- Evidence section showing supporting data
- Hypothesis card (if present)
- Modern design with shadows, rounded corners
- Color scheme based on severity:
  * critical: red theme
  * high: orange theme
  * normal: blue theme
  * low: green theme

Include data-slot-id attributes for dynamic content:
- data-slot-id="live-chart" for the chart area
- data-slot-id="current-value" for current readings
- data-slot-id="status" for real-time status
- data-slot-id="timestamp" for last update time

Make it IMPRESSIVE - something you'd show to executives!
Use modern CSS with gradients, shadows, and clean typography.
`;

    // Step 2: Generate HTML with v0
    console.log("[Visual Report] Step 1: Calling v0 API to generate HTML...");
    console.log("[Visual Report] V0 prompt length:", v0Prompt.length, "chars");
    const startV0 = Date.now();
    const { html } = await generateHtmlWithV0({ prompt: v0Prompt });
    const v0Time = Date.now() - startV0;
    const cardId = crypto.randomUUID();

    console.log("[Visual Report] ✓ v0 API call completed in", v0Time, "ms");
    console.log("[Visual Report] HTML generated, length:", html.length, "chars");
    console.log("[Visual Report] Card ID:", cardId);

    // Step 3: Generate live dashboard script
    console.log("[Visual Report] Step 2: Generating dashboard script...");
    const allStreams = discovery.evidence?.streams || ['fcu-01_04-spacetemp'];
    // Limit to 2 streams for MQTT connection limits
    const streams = allStreams.slice(0, 2);
    console.log("[Visual Report] Streams for dashboard:", streams, allStreams.length > 2 ? `(limited from ${allStreams.length})` : '');
    const script = generateDashboardScript(cardId, streams, discovery);

    console.log("[Visual Report] ✓ Script generated, length:", script.length, "chars");

    // Step 4: Publish dashboard
    console.log("[Visual Report] Step 3: Publishing dashboard to database...");
    const slug = generateSlug(discovery.title);
    const accessToken = generateAccessToken();
    console.log("[Visual Report] Generated slug:", slug);
    console.log("[Visual Report] Generated access token (length):", accessToken.length);

    const baseUrl = process.env.NEXT_PUBLIC_URL ||
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const dashboardUrl = `${baseUrl}/d/${slug}`;
    console.log("[Visual Report] Dashboard URL:", dashboardUrl);
    console.log("[Visual Report] Base URL:", baseUrl);

    // Save to database directly
    console.log("[Visual Report] Creating database connection...");
    const client = postgres(process.env.POSTGRES_URL!);
    const dbConn = drizzle(client);

    console.log("[Visual Report] Inserting dashboard into database...");
    const dashboardData = {
      userId: '00000000-0000-0000-0000-000000000000', // System user for Jeeves
      chatId: null,
      title: discovery.title,
      description: discovery.reasoning.substring(0, 200),
      html,
      script,
      cardId,
      slug,
      accessToken,
      password: null,
      expiresAt: null, // Never expires
      maxViews: null,
      currentViews: "0",
      streams: streams.map((s: string) => ({ id: s, name: s })),
      config: { refreshRate: 1000, theme: 'auto', cardId },
      status: "active" as const,
    };
    console.log("[Visual Report] Dashboard data prepared:", {
      userId: dashboardData.userId,
      title: dashboardData.title,
      slug: dashboardData.slug,
      streamsCount: streams.length
    });

    const [dashboard] = await dbConn.insert(publishedDashboard).values(dashboardData).returning();

    console.log("[Visual Report] ✓ Dashboard published to database");
    console.log("[Visual Report] Dashboard ID:", dashboard.id);
    console.log("[Visual Report] Dashboard URL:", dashboardUrl);
    console.log("[Visual Report] ========================================");

    return {
      dashboardId: dashboard.id,
      dashboardSlug: slug,
      dashboardUrl,
      html,
      script,
      cardId,
    };

  } catch (error: any) {
    console.error("[Visual Report] ========================================");
    console.error("[Visual Report] ❌ FATAL ERROR in visual report generation");
    console.error("[Visual Report] Error type:", error.constructor.name);
    console.error("[Visual Report] Error message:", error.message);
    console.error("[Visual Report] Error stack:", error.stack);
    console.error("[Visual Report] ========================================");
    throw error;
  }
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
// Jeeves Live Dashboard Script
// Card ID: ${cardId}
// Generated: ${new Date().toISOString()}

console.log('[Dashboard] Initializing Jeeves discovery dashboard...');
console.log('[Dashboard] Streams:', ${JSON.stringify(streams)});

// Subscribe to all streams (max 2 for MQTT limits)
const streamData = {};
${streams.map((s: string, idx: number) => `
const stream${idx} = ${JSON.stringify(s)};
console.log('[Dashboard] Subscribing to stream ${idx}:', stream${idx});
api.subscribe(\`/api/telemetry/stream?streamId=\${stream${idx}}&intervalMs=1000\`);
streamData[stream${idx}] = { values: [], latest: null };
`).join('')}

const maxPoints = 60;

// Handle incoming data from all streams
api.on('tick', (data) => {
  const streamId = data.sensorId || data.streamId;
  const value = data.value || data.temperature || data.temp || 0;
  const timestamp = new Date(data.timestamp || data.ts || Date.now());

  console.log('[Dashboard] Received data from', streamId, ':', value);

  // Store data for this stream
  if (streamData[streamId]) {
    streamData[streamId].latest = value;
    streamData[streamId].values.push({ time: timestamp, value: value });
    if (streamData[streamId].values.length > maxPoints) {
      streamData[streamId].values.shift();
    }
  }

  // Update current value (show first stream or latest)
  const primaryValue = streamData[${JSON.stringify(streams[0])}]?.latest || value;
  api.replaceSlot('current-value', primaryValue.toFixed(2));

  // Update timestamp
  api.replaceSlot('timestamp', timestamp.toLocaleTimeString());

  // Update status
  api.replaceSlot('status', '🟢 Live');

  // Get all data points for chart (use primary stream)
  const dataPoints = streamData[${JSON.stringify(streams[0])}]?.values || [];

  // Create SVG line chart
  if (dataPoints.length > 2) {
    const values = dataPoints.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const width = 600;
    const height = 300;
    const padding = 40;

    // Create SVG path for line chart
    const points = dataPoints.map((d, i) => {
      const x = padding + (i / (dataPoints.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((d.value - min) / range) * (height - 2 * padding);
      return \`\${x},\${y}\`;
    }).join(' ');

    const chartHtml = \`
      <svg viewBox="0 0 \${width} \${height}" style="width: 100%; height: auto; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 8px;">
        <!-- Grid lines -->
        <line x1="\${padding}" y1="\${padding}" x2="\${padding}" y2="\${height - padding}" stroke="#334155" stroke-width="2"/>
        <line x1="\${padding}" y1="\${height - padding}" x2="\${width - padding}" y2="\${height - padding}" stroke="#334155" stroke-width="2"/>

        <!-- Y-axis labels -->
        <text x="\${padding - 10}" y="\${padding}" text-anchor="end" fill="#94a3b8" font-size="12">\${max.toFixed(1)}</text>
        <text x="\${padding - 10}" y="\${height - padding}" text-anchor="end" fill="#94a3b8" font-size="12">\${min.toFixed(1)}</text>

        <!-- Line chart -->
        <polyline
          points="\${points}"
          fill="none"
          stroke="url(#gradient)"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Gradient definition -->
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
          </linearGradient>
        </defs>

        <!-- Current value indicator -->
        <circle cx="\${width - padding}" cy="\${height - padding - ((value - min) / range) * (height - 2 * padding)}" r="5" fill="#3b82f6" stroke="#ffffff" stroke-width="2"/>

        <!-- Stats text -->
        <text x="\${width / 2}" y="25" text-anchor="middle" fill="#f1f5f9" font-size="14" font-weight="600">
          Latest: \${value.toFixed(2)} | Range: \${min.toFixed(1)} - \${max.toFixed(1)} | Points: \${dataPoints.length}
        </text>
      </svg>
    \`;

    api.replaceSlot('live-chart', chartHtml);
  }
});

// Handle errors
api.on('error', (error) => {
  console.error('[Dashboard] Error:', error);
  api.replaceSlot('status', '🔴 Error');
});

console.log('[Dashboard] Initialization complete');
`;
}
