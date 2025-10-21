/**
 * Inngest API Route Handler
 *
 * Serves all Inngest functions for the application
 * Inngest will call this endpoint to execute background jobs
 */

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import {
  processNotifications,
  processPersonaNotification,
  sendNotificationEmail
} from "@/lib/inngest/functions/process-notifications";
import { fcuDataIngestion } from "@/lib/inngest/functions/fcu-data-ingestion";
import { telemetryCleanup } from "@/lib/inngest/functions/telemetry-cleanup";
import { jeevesAutoScheduler } from "@/lib/inngest/functions/jeeves-auto-scheduler";

// Configure Vercel function timeout to 300 seconds (5 minutes)
// This allows complex dashboard generation to complete
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processNotifications,         // Coordinator - fans out to personas
    processPersonaNotification,   // Individual persona handler (generates notification + dashboard)
    sendNotificationEmail,        // Email sender (separate, rate-limited)
    fcuDataIngestion,             // FCU data ingestion for Jeeves analysis (runs every minute)
    telemetryCleanup,             // Cleanup old telemetry data (runs daily at 3 AM)
    jeevesAutoScheduler,          // Auto-scheduler for Jeeves analysis (checks every 5min)
  ],
  servePath: "/api/inngest",
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
