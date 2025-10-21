import { auth } from "@/app/(auth)/auth";
import { publishedDashboard } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import crypto from "crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:api").toResponse();
    }

    const body = await request.json();
    const {
      title,
      description,
      cardId,
      html,
      script,
      streams,
      expiresIn,
      password,
      maxViews,
    } = body;

    // Validation
    if (!title || !cardId || !html || !script) {
      return new ChatSDKError(
        "bad_request:api",
        "Missing required fields: title, cardId, html, script"
      ).toResponse();
    }

    // Generate unique identifiers
    const slug = generateSlug(title);
    const accessToken = crypto.randomBytes(32).toString('hex');

    // Calculate expiry
    const expiresAt = calculateExpiry(expiresIn || 'never');

    // Hash password if provided
    let hashedPassword: string | null = null;
    if (password) {
      hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    }

    // Prepare streams metadata
    const streamsMetadata = Array.isArray(streams)
      ? streams.map((streamId: string) => ({
          id: streamId,
          name: streamId,
          url: `/api/telemetry/stream?streamId=${streamId}`,
        }))
      : [];

    // Database connection
    const client = postgres(process.env.POSTGRES_URL!);
    const db = drizzle(client);

    // Save to database
    const [dashboard] = await db.insert(publishedDashboard).values({
      userId: session.user.id,
      chatId: null,
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
      config: {
        refreshRate: 1000,
        theme: 'light',
        cardId,
      },
      status: "active",
    }).returning();

    // Construct URL - use Vercel URL if available
    const baseUrl = process.env.NEXT_PUBLIC_URL ||
                   process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                   'http://localhost:3000';
    const url = `${baseUrl}/d/${slug}`;

    return Response.json({
      success: true,
      url,
      slug,
      dashboardId: dashboard.id,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      message: `Dashboard published successfully!`,
    });

  } catch (error) {
    console.error("[Publish Dashboard API] Error:", error);
    return new ChatSDKError(
      "bad_request:api",
      `Failed to publish dashboard: ${error instanceof Error ? error.message : String(error)}`
    ).toResponse();
  }
}

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