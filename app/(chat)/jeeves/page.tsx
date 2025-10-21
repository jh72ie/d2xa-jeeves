/**
 * Jeeves Console - Main Page
 *
 * Open-access dashboard showing all Jeeves activity:
 * - Status and configuration
 * - All personas with unread counts
 * - Recent discoveries with embedded dashboards
 * - Notification feed
 */

import { Suspense } from "react";
import { ensureJeevesState, getRecentDiscoveries, getAllNotifications } from "@/lib/db/jeeves-queries";
import { db } from "@/lib/db/queries";
import { persona } from "@/lib/db/userlog-schema";
import { StatusPanel } from "@/components/jeeves/status-panel";
import { PersonaCards } from "@/components/jeeves/persona-cards";
import { DiscoveryCard } from "@/components/jeeves/discovery-card";
import { NotificationsList } from "@/components/jeeves/notifications-list";
import { SettingsPanel } from "@/components/jeeves/settings-panel";
import { ActivityLog } from "@/components/jeeves/activity-log";

/**
 * Load persona data with unread counts
 */
async function loadPersonas() {
  const personas = await db.select().from(persona);

  // For each persona, we'll get unread count in the client component
  // to avoid N+1 queries here
  return personas;
}

/**
 * Main Jeeves Console Page
 */
export default async function JeevesCommandCenter() {
  // Load all data (ensureJeevesState will create state if not exists)
  const [state, discoveries, notifications, personas] = await Promise.all([
    ensureJeevesState(),
    getRecentDiscoveries(24, 20),
    getAllNotifications(50),
    loadPersonas(),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
          🎩 Jeeves Console
        </h1>
        <p className="text-muted-foreground mt-2">
          AI Butler monitoring telemetry streams and delivering personalized insights
        </p>
      </header>

      {/* Status and Settings Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <StatusPanel state={state} />
        <SettingsPanel initialState={state} />
      </div>

      {/* Activity Log */}
      <div className="mb-8">
        <ActivityLog />
      </div>

      {/* Personas Grid */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          👥 Team Members
        </h2>
        <PersonaCards personas={personas} />
      </section>

      {/* Recent Discoveries */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          🔍 Recent Discoveries
        </h2>
        {discoveries.length === 0 ? (
          <div className="border rounded-lg p-12 text-center text-muted-foreground">
            <p className="text-lg mb-2">No discoveries yet</p>
            <p className="text-sm">
              Enable Jeeves and click "Analyze Now" to start discovering insights
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {discoveries.map((discovery) => (
              <DiscoveryCard key={discovery.id} discovery={discovery} />
            ))}
          </div>
        )}
      </section>

      {/* All Notifications Feed */}
      <section id="notifications-feed">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          📬 Notification Feed
        </h2>
        <NotificationsList initialNotifications={notifications} />
      </section>
    </div>
  );
}

export const metadata = {
  title: "Jeeves Console",
  description: "AI Butler monitoring and insights",
};

// Force dynamic rendering to avoid database queries during build
// This prevents build failures when database quota is exceeded
export const dynamic = 'force-dynamic';
export const revalidate = 0;
