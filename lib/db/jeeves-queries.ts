/**
 * Jeeves Database Queries
 *
 * Database operations for Jeeves AI butler system
 */

import "server-only";
import { eq, desc, and, gte, isNull } from "drizzle-orm";
import { db } from "./queries";
import {
  jeevesState,
  jeevesDiscovery,
  jeevesNotification,
  jeevesLearning,
  jeevesActivityLog,
  type JeevesState,
  type JeevesDiscovery,
  type JeevesNotification,
  type JeevesLearning,
  type JeevesActivityLog,
} from "./schema";

// ============================================================================
// Jeeves State Operations
// ============================================================================

/**
 * Get global Jeeves state (configuration)
 */
export async function getJeevesState(): Promise<JeevesState | null> {
  const [state] = await db.select().from(jeevesState).limit(1);
  return state || null;
}

/**
 * Update Jeeves state
 */
export async function updateJeevesState(updates: Partial<JeevesState>): Promise<void> {
  const state = await getJeevesState();
  if (!state) {
    throw new Error("Jeeves state not initialized");
  }

  await db
    .update(jeevesState)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(jeevesState.id, state.id));
}

/**
 * Initialize Jeeves state if not exists
 */
export async function ensureJeevesState(): Promise<JeevesState> {
  let state = await getJeevesState();

  if (!state) {
    const [newState] = await db
      .insert(jeevesState)
      .values({
        enabled: false,
        ingestionEnabled: true, // FCU data ingestion enabled by default
        analysisInterval: "1hour", // Default to 1 hour (more reasonable than 5 minutes)
        monitoredStreams: [
          // Direct MQTT streams (raw sensor data)
          "fcu-201-effectsetpt",      // Effective setpoint temperature
          "fcu-201-spacetemp",         // Current space temperature
          "fcu-201-heatoutput",        // Heat valve output %
          "fcu-201-cooloutput",        // Cool valve output %
          "fcu-201-setpoint",          // User setpoint
          "fcu-201-effectoccup",       // Occupancy state (enum converted to numeric)
          "fcu-201-fanspeedstate",     // Fan state (enum converted to numeric)
          // Parsed streams (processed by ingestion worker)
          "fcu-201-parsed-spacetemp",
          "fcu-201-parsed-effectsetpoint",
          "fcu-201-parsed-usersetpoint",
          "fcu-201-parsed-heatoutput",
          "fcu-201-parsed-cooloutput",
          "fcu-201-parsed-status"
        ], // Comprehensive FCU-201 monitoring (13 streams including enum-converted fields)
      })
      .returning();
    state = newState;
  }

  return state;
}

// ============================================================================
// Discovery Operations
// ============================================================================

/**
 * Create a new discovery
 */
export async function createDiscovery(
  discovery: Omit<JeevesDiscovery, "id" | "discoveredAt">
): Promise<JeevesDiscovery> {
  const [newDiscovery] = await db
    .insert(jeevesDiscovery)
    .values(discovery)
    .returning();

  // Increment total discoveries count
  const state = await getJeevesState();
  if (state) {
    const count = parseInt(state.totalDiscoveries || "0", 10);
    await updateJeevesState({
      totalDiscoveries: String(count + 1),
    });
  }

  return newDiscovery;
}

/**
 * Get recent discoveries (last N hours)
 */
export async function getRecentDiscoveries(
  hoursAgo: number = 24,
  limit: number = 50
): Promise<JeevesDiscovery[]> {
  const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

  return await db
    .select()
    .from(jeevesDiscovery)
    .where(gte(jeevesDiscovery.discoveredAt, cutoff))
    .orderBy(desc(jeevesDiscovery.discoveredAt))
    .limit(limit);
}

/**
 * Get discoveries by status
 */
export async function getDiscoveriesByStatus(
  status: string,
  limit: number = 50
): Promise<JeevesDiscovery[]> {
  return await db
    .select()
    .from(jeevesDiscovery)
    .where(eq(jeevesDiscovery.status, status))
    .orderBy(desc(jeevesDiscovery.discoveredAt))
    .limit(limit);
}

/**
 * Update discovery status
 */
export async function updateDiscoveryStatus(
  discoveryId: string,
  status: string
): Promise<void> {
  await db
    .update(jeevesDiscovery)
    .set({ status })
    .where(eq(jeevesDiscovery.id, discoveryId));
}

/**
 * Add persona-specific dashboard to discovery
 */
export async function addPersonaDashboard(
  discoveryId: string,
  dashboard: {
    personaName: string;
    dashboardId: string;
    dashboardUrl: string;
    format: string;
  }
): Promise<void> {
  const [discovery] = await db
    .select()
    .from(jeevesDiscovery)
    .where(eq(jeevesDiscovery.id, discoveryId))
    .limit(1);

  if (!discovery) {
    throw new Error(`Discovery ${discoveryId} not found`);
  }

  const currentDashboards = (discovery.personaDashboards as any[]) || [];
  const updatedDashboards = [
    ...currentDashboards,
    {
      personaName: dashboard.personaName,
      dashboardId: dashboard.dashboardId,
      dashboardUrl: dashboard.dashboardUrl,
      format: dashboard.format,
      createdAt: new Date().toISOString(),
    },
  ];

  await db
    .update(jeevesDiscovery)
    .set({ personaDashboards: updatedDashboards })
    .where(eq(jeevesDiscovery.id, discoveryId));
}

/**
 * Get discovery by ID
 */
export async function getDiscoveryById(id: string): Promise<JeevesDiscovery | null> {
  const [discovery] = await db
    .select()
    .from(jeevesDiscovery)
    .where(eq(jeevesDiscovery.id, id))
    .limit(1);

  return discovery || null;
}

// ============================================================================
// Notification Operations
// ============================================================================

/**
 * Create notification for a persona
 */
export async function createNotification(
  notification: Omit<JeevesNotification, "id" | "sentAt">
): Promise<JeevesNotification> {
  const [newNotification] = await db
    .insert(jeevesNotification)
    .values(notification)
    .returning();

  return newNotification;
}

/**
 * Get notifications for a persona
 */
export async function getNotificationsByPersona(
  personaName: string,
  limit: number = 50
): Promise<JeevesNotification[]> {
  return await db
    .select()
    .from(jeevesNotification)
    .where(eq(jeevesNotification.personaName, personaName))
    .orderBy(desc(jeevesNotification.sentAt))
    .limit(limit);
}

/**
 * Get unread notifications for a persona
 */
export async function getUnreadNotifications(
  personaName: string
): Promise<JeevesNotification[]> {
  return await db
    .select()
    .from(jeevesNotification)
    .where(
      and(
        eq(jeevesNotification.personaName, personaName),
        isNull(jeevesNotification.viewedAt)
      )
    )
    .orderBy(desc(jeevesNotification.sentAt));
}

/**
 * Count unread notifications for a persona
 */
export async function countUnreadNotifications(personaName: string): Promise<number> {
  const notifications = await getUnreadNotifications(personaName);
  return notifications.length;
}

/**
 * Mark notification as viewed
 */
export async function markNotificationViewed(notificationId: string): Promise<void> {
  await db
    .update(jeevesNotification)
    .set({ viewedAt: new Date() })
    .where(eq(jeevesNotification.id, notificationId));
}

/**
 * Mark notification as acknowledged
 */
export async function markNotificationAcknowledged(notificationId: string): Promise<void> {
  await db
    .update(jeevesNotification)
    .set({ acknowledgedAt: new Date() })
    .where(eq(jeevesNotification.id, notificationId));
}

/**
 * Get all notifications (for admin view)
 */
export async function getAllNotifications(limit: number = 100): Promise<JeevesNotification[]> {
  return await db
    .select()
    .from(jeevesNotification)
    .orderBy(desc(jeevesNotification.sentAt))
    .limit(limit);
}

/**
 * Get notifications for a discovery
 */
export async function getNotificationsByDiscovery(
  discoveryId: string
): Promise<JeevesNotification[]> {
  return await db
    .select()
    .from(jeevesNotification)
    .where(eq(jeevesNotification.discoveryId, discoveryId))
    .orderBy(desc(jeevesNotification.sentAt));
}

// ============================================================================
// Learning Operations
// ============================================================================

/**
 * Save feedback for learning
 */
export async function saveJeevesLearning(
  learning: Omit<JeevesLearning, "id" | "createdAt">
): Promise<JeevesLearning> {
  const [newLearning] = await db
    .insert(jeevesLearning)
    .values(learning)
    .returning();

  return newLearning;
}

/**
 * Get learning history for a persona
 */
export async function getLearningByPersona(
  personaName: string,
  limit: number = 100
): Promise<JeevesLearning[]> {
  return await db
    .select()
    .from(jeevesLearning)
    .where(eq(jeevesLearning.personaName, personaName))
    .orderBy(desc(jeevesLearning.createdAt))
    .limit(limit);
}

/**
 * Submit feedback on notification
 */
export async function submitNotificationFeedback(
  notificationId: string,
  helpful: boolean,
  comment?: string
): Promise<void> {
  // Update notification feedback
  await db
    .update(jeevesNotification)
    .set({
      feedback: {
        helpful,
        comment: comment || null,
        submittedAt: new Date().toISOString(),
      },
    })
    .where(eq(jeevesNotification.id, notificationId));

  // Get notification details for learning
  const [notification] = await db
    .select()
    .from(jeevesNotification)
    .where(eq(jeevesNotification.id, notificationId))
    .limit(1);

  if (notification) {
    // Save to learning table
    await saveJeevesLearning({
      discoveryId: notification.discoveryId,
      notificationId: notification.id,
      personaName: notification.personaName,
      actionTaken: "notification_sent",
      outcome: helpful ? "helpful" : "not_helpful",
      feedbackScore: helpful ? "1" : "-1",
      learnedPattern: comment || `User ${helpful ? "appreciated" : "did not appreciate"} ${notification.format} format notification`,
    });
  }
}

// ============================================================================
// Activity Log Operations
// ============================================================================

/**
 * Log activity for an execution
 */
export async function logActivity(
  executionId: string,
  level: "info" | "success" | "warning" | "error",
  message: string,
  metadata?: Record<string, any>
): Promise<void> {
  await db.insert(jeevesActivityLog).values({
    executionId,
    level,
    message,
    metadata: metadata || {},
  });
}

/**
 * Get recent activity logs
 */
export async function getRecentActivityLogs(limit = 100): Promise<JeevesActivityLog[]> {
  return db
    .select()
    .from(jeevesActivityLog)
    .orderBy(desc(jeevesActivityLog.timestamp))
    .limit(limit);
}

/**
 * Get activity logs for specific execution
 */
export async function getExecutionActivityLogs(executionId: string): Promise<JeevesActivityLog[]> {
  return db
    .select()
    .from(jeevesActivityLog)
    .where(eq(jeevesActivityLog.executionId, executionId))
    .orderBy(jeevesActivityLog.timestamp);
}
