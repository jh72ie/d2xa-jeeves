import { tool } from "ai";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { publishedDashboard } from "@/lib/db/schema";
import crypto from "crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/**
 * Generate a URL-friendly slug from title with random suffix
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
 * Calculate expiry timestamp based on duration string
 */
function calculateExpiry(duration: '1h' | '24h' | '7d' | '30d' | 'never'): Date | null {
  if (duration === 'never') return null;

  const now = new Date();
  const durations: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  return new Date(now.getTime() + durations[duration]);
}

/**
 * Hash password using crypto (Note: In production, use bcrypt)
 */
async function hashPassword(password: string): Promise<string> {
  // Simple hash for now - replace with bcrypt in production
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function publishDashboardTool({ dataStream }: { dataStream: any }) {
  return tool({
    description: `Publish a dashboard to a shareable URL. Creates a unique, secure link that can be shared with specific users.

The dashboard will be live at: https://your-app.vercel.app/d/[slug]

Features:
- Unique, unguessable URLs
- Optional password protection
- Expiry dates (1h, 24h, 7d, 30d, or never)
- View limits
- Access tracking

Use this when the user wants to:
- Share a dashboard with colleagues
- Create a public report
- Send real-time data to stakeholders
- Generate a shareable link for external users`,

    inputSchema: z.object({
      title: z.string().describe("Dashboard title (e.g., 'Temperature Anomaly Monitor')"),
      description: z.string().optional().describe("Optional description of what the dashboard shows"),
      cardId: z.string().describe("The V0Card ID from the previously created dashboard"),
      html: z.string().describe("Dashboard HTML content from V0Card"),
      script: z.string().describe("Dashboard script from claudeCode tool"),
      streams: z.array(z.string()).describe("Array of stream IDs used in the dashboard"),

      // Access control options
      expiresIn: z.enum(['1h', '24h', '7d', '30d', 'never'])
        .default('never')
        .describe("When the dashboard link should expire"),
      password: z.string().optional().describe("Optional password to protect the dashboard"),
      maxViews: z.number().optional().describe("Optional maximum number of views allowed"),
    }),

    execute: async ({
      title,
      description,
      cardId,
      html,
      script,
      streams,
      expiresIn,
      password,
      maxViews
    }) => {
      console.log("[publishDashboard] Starting dashboard publication");
      console.log("[publishDashboard] Title:", title);
      console.log("[publishDashboard] CardId:", cardId);
      console.log("[publishDashboard] Streams:", streams);

      try {
        // Get current user session
        const session = await auth();
        if (!session?.user?.id) {
          throw new Error("User not authenticated");
        }

        // Generate unique identifiers
        const slug = generateSlug(title);
        const accessToken = generateAccessToken();

        console.log("[publishDashboard] Generated slug:", slug);
        console.log("[publishDashboard] Generated token:", accessToken.substring(0, 16) + "...");

        // Calculate expiry
        const expiresAt = calculateExpiry(expiresIn);
        console.log("[publishDashboard] Expiry:", expiresAt ? expiresAt.toISOString() : 'never');

        // Hash password if provided
        let hashedPassword: string | null = null;
        if (password) {
          hashedPassword = await hashPassword(password);
          console.log("[publishDashboard] Password protection enabled");
        }

        // Prepare streams metadata
        const streamsMetadata = streams.map(streamId => ({
          id: streamId,
          name: streamId,
          url: `/api/telemetry/stream?streamId=${streamId}`,
        }));

        // Prepare config
        const config = {
          refreshRate: 1000,
          theme: 'light',
          cardId,
        };

        // Database connection
        const client = postgres(process.env.POSTGRES_URL!);
        const db = drizzle(client);

        // Save to database
        console.log("[publishDashboard] Saving to database...");
        const [dashboard] = await db.insert(publishedDashboard).values({
          userId: session.user.id,
          chatId: null, // TODO: Get from context
          title,
          description: description || null,
          html,
          script,
          cardId,
          slug,
          accessToken,
          password: hashedPassword,
          expiresAt,
          maxViews: maxViews ? String(maxViews) : null,
          currentViews: "0",
          streams: streamsMetadata,
          config,
          status: "active",
        }).returning();

        console.log("[publishDashboard] Dashboard saved with ID:", dashboard.id);

        // Construct URL - use Vercel URL if available
        const baseUrl = process.env.NEXT_PUBLIC_URL ||
                       process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                       'http://localhost:3000';
        const url = `${baseUrl}/d/${slug}`;

        console.log("[publishDashboard] Dashboard published at:", url);

        // Send success message via data stream
        dataStream.write({
          type: "data-dashboard-published",
          data: {
            id: dashboard.id,
            url,
            slug,
            title,
            expiresAt,
            maxViews,
            hasPassword: !!password,
          },
        });

        // Return result
        const result = {
          success: true,
          url,
          slug,
          dashboardId: dashboard.id,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
          message: `✅ Dashboard published successfully!

🔗 **Share this link:** ${url}

📊 **Dashboard:** ${title}
${description ? `📝 **Description:** ${description}\n` : ''}${expiresAt ? `⏰ **Expires:** ${expiresAt.toLocaleString()}\n` : ''}${password ? `🔒 **Password protected:** Yes\n` : ''}${maxViews ? `👁️ **View limit:** ${maxViews} views\n` : ''}
Anyone with this link can view the live dashboard. ${password ? 'They will need the password you set.' : ''}`,
        };

        console.log("[publishDashboard] Publication complete");
        return result;

      } catch (error) {
        console.error("[publishDashboard] Error:", error);
        throw new Error(`Failed to publish dashboard: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  });
}